import React, { useEffect, useRef, useState } from 'react';
import { writeText } from '@tauri-apps/api/clipboard';
import { Copy, Delete, Languages, Volume2, WrapText } from 'lucide-react';
import { appWindow } from '@tauri-apps/api/window';
import toast from 'react-hot-toast';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api';
import { atom, useAtom } from 'jotai';

import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import ToolbarButton from '../../../../components/app/ToolbarButton';
import { getServiceName, getServiceSouceType, ServiceSourceType } from '../../../../utils/service_instance';
import { filterAvailableServices } from '../../../../utils/service_availability';
import { useConfig, useSyncAtom, useToastStyle } from '../../../../hooks';
import { useTranslationReadAloud } from '../../../../hooks/useTranslationReadAloud';
import { useReadAloudPlaybackRate } from '../../../../hooks/useReadAloudPlaybackRate';
import TranslationReadAloudControls from '../../../../components/TranslationReadAloudControls';
import { normalizeReadAloudText, toReadAloudSpeechText } from '../../../../utils/read_aloud';
import { synthesizeWithFallback } from '../../../../utils/tts';
import { formatTtsFallbackNotice } from '../../../../utils/tts_fallback';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as recognizeServices from '../../../../services/recognize';
import detect from '../../../../utils/lang_detect';
import { store } from '../../../../utils/store';
import { info } from 'tauri-plugin-log-api';
import { debug } from 'tauri-plugin-log-api';

export const sourceTextAtom = atom('');
export const detectLanguageAtom = atom('');
export const ocrLanguageHintAtom = atom(null);

let unlisten = null;
let timer = null;

export default function SourceArea(props) {
    const { pluginList, serviceInstanceConfigMap } = props;
    const [sourceText, setSourceText, syncSourceText] = useSyncAtom(sourceTextAtom);
    const [detectLanguage, setDetectLanguage] = useAtom(detectLanguageAtom);
    const [incrementalTranslate] = useConfig('incremental_translate', false);
    const [dynamicTranslate] = useConfig('dynamic_translate', false);
    const [deleteNewline] = useConfig('translate_delete_newline', false);
    const [recognizeLanguage] = useConfig('recognize_language', 'auto');
    const [followOcrLanguage] = useConfig('translate_follow_ocr_language', false);
    const [, setOcrLanguageHint] = useAtom(ocrLanguageHintAtom);
    const [recognizeServiceList] = useConfig('recognize_service_list', ['system', 'tesseract']);
    const [ttsServiceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [hideWindow] = useConfig('translate_hide_window', false);
    const [hideSource] = useConfig('hide_source', false);
    const [windowType, setWindowType] = useState('[SELECTION_TRANSLATE]');
    const toastStyle = useToastStyle();
    const { t } = useTranslation();
    const textAreaRef = useRef();
    const voice = useTranslationReadAloud('source', sourceText);
    const [playbackRate, setPlaybackRate] = useReadAloudPlaybackRate();

    const handleNewText = async (text) => {
        voice.stop();
        text = text.trim();
        if (hideWindow) {
            appWindow.hide();
        } else {
            appWindow.show();
            appWindow.setFocus();
        }
        // 清空检测语言
        setDetectLanguage('');
        setOcrLanguageHint(null);
        if (text === '[INPUT_TRANSLATE]') {
            setWindowType('[INPUT_TRANSLATE]');
            appWindow.show();
            appWindow.setFocus();
            setSourceText('', true);
        } else if (text === '[IMAGE_TRANSLATE]') {
            setWindowType('[IMAGE_TRANSLATE]');
            const base64 = await invoke('get_base64');
            const serviceInstanceKey = filterAvailableServices(
                recognizeServiceList,
                recognizeServices,
                pluginList.recognize,
                (key) => info(`Skipping unavailable recognition service: ${key}`)
            )[0];
            if (!serviceInstanceKey) return;
            if (getServiceSouceType(serviceInstanceKey) === ServiceSourceType.PLUGIN) {
                if (recognizeLanguage in pluginList['recognize'][getServiceName(serviceInstanceKey)].language) {
                    const pluginConfig = serviceInstanceConfigMap[serviceInstanceKey];

                    let [func, utils] = await invoke_plugin('recognize', getServiceName(serviceInstanceKey));
                    func(
                        base64,
                        pluginList['recognize'][getServiceName(serviceInstanceKey)].language[recognizeLanguage],
                        {
                            config: pluginConfig,
                            utils,
                        }
                    ).then(
                        (v) => {
                            let newText = v.trim();
                            if (deleteNewline) {
                                newText = v.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                            } else {
                                newText = v.trim();
                            }
                            if (incrementalTranslate) {
                                setSourceText((old) => {
                                    return old + ' ' + newText;
                                });
                            } else {
                                setSourceText(newText);
                            }
                            if (!incrementalTranslate)
                                setOcrLanguageHint({ text: newText, language: recognizeLanguage });
                            detect_language(newText, !incrementalTranslate ? recognizeLanguage : 'auto').then(() => {
                                syncSourceText();
                            });
                        },
                        (e) => {
                            setSourceText(e.toString());
                        }
                    );
                } else {
                    setSourceText('Language not supported');
                }
            } else {
                if (recognizeLanguage in recognizeServices[getServiceName(serviceInstanceKey)].Language) {
                    const instanceConfig = serviceInstanceConfigMap[serviceInstanceKey];
                    recognizeServices[getServiceName(serviceInstanceKey)]
                        .recognize(
                            base64,
                            recognizeServices[getServiceName(serviceInstanceKey)].Language[recognizeLanguage],
                            {
                                config: instanceConfig,
                            }
                        )
                        .then(
                            (v) => {
                                let newText = v.trim();
                                if (deleteNewline) {
                                    newText = v.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                                } else {
                                    newText = v.trim();
                                }
                                if (incrementalTranslate) {
                                    setSourceText((old) => {
                                        return old + ' ' + newText;
                                    });
                                } else {
                                    setSourceText(newText);
                                }
                                if (!incrementalTranslate)
                                    setOcrLanguageHint({ text: newText, language: recognizeLanguage });
                                detect_language(newText, !incrementalTranslate ? recognizeLanguage : 'auto').then(
                                    () => {
                                        syncSourceText();
                                    }
                                );
                            },
                            (e) => {
                                setSourceText(e.toString());
                            }
                        );
                } else {
                    setSourceText('Language not supported');
                }
            }
        } else {
            setWindowType('[SELECTION_TRANSLATE]');
            let newText = text.trim();
            if (deleteNewline) {
                newText = text.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
            } else {
                newText = text.trim();
            }
            if (incrementalTranslate) {
                setSourceText((old) => {
                    return old + ' ' + newText;
                });
            } else {
                setSourceText(newText);
            }
            detect_language(newText).then(() => {
                syncSourceText();
            });
        }
    };

    const keyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            detect_language(sourceText).then(() => {
                syncSourceText();
            });
        }
        if (event.key === 'Escape') {
            voice.stop();
            appWindow.close();
        }
    };

    const handleSpeak = async (shouldContinue) => {
        const speechText = toReadAloudSpeechText(normalizeReadAloudText(sourceText));
        return synthesizeWithFallback({
            text: speechText,
            serviceInstanceList: ttsServiceList,
            getConfig: (instanceKey) => serviceInstanceConfigMap[instanceKey] ?? {},
            shouldContinue,
            language: {
                mode: 'detect',
                detect: async (text) => {
                    let detected = detectLanguage;
                    if (!detected) {
                        detected = await detect(text);
                        setDetectLanguage(detected);
                    }
                    return detected;
                },
            },
        });
    };

    useEffect(() => {
        if (hideWindow !== null) {
            if (unlisten) {
                unlisten.then((f) => {
                    f();
                });
            }
            unlisten = listen('new_text', (event) => {
                appWindow.setFocus();
                handleNewText(event.payload);
            });
        }
    }, [hideWindow]);

    useEffect(() => {
        if (
            deleteNewline !== null &&
            incrementalTranslate !== null &&
            recognizeLanguage !== null &&
            recognizeServiceList !== null &&
            hideWindow !== null
        ) {
            invoke('get_text').then((v) => {
                handleNewText(v);
            });
        }
    }, [deleteNewline, incrementalTranslate, recognizeLanguage, recognizeServiceList, hideWindow, followOcrLanguage]);

    useEffect(() => {
        textAreaRef.current.style.height = '50px';
        textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
    }, [sourceText]);

    const detect_language = async (text, ocrLanguage = 'auto') => {
        setDetectLanguage(
            followOcrLanguage && ocrLanguage && ocrLanguage !== 'auto' ? ocrLanguage : await detect(text)
        );
    };

    let sourceTextChangeTimer = null;
    const changeSourceText = async (text) => {
        setDetectLanguage('');
        await setSourceText(text);
        if (dynamicTranslate) {
            if (sourceTextChangeTimer) {
                clearTimeout(sourceTextChangeTimer);
            }
            sourceTextChangeTimer = setTimeout(() => {
                detect_language(text).then(() => {
                    syncSourceText();
                });
            }, 1000);
        }
    };

    const transformVarName = function (str) {
        let str2 = str;

        // snake_case to SNAKE_CASE
        if (/_[a-z]/.test(str2)) {
            str2 = str2
                .split('_')
                .map((it) => it.toLocaleUpperCase())
                .join('_');
        }
        if (str2 !== str) {
            return str2;
        }

        // SNAKE_CASE to kebab-case
        if (/^[A-Z]+(_[A-Z]+)*$/.test(str2)) {
            str2 = str2
                .split('_')
                .map((it) => it.toLocaleLowerCase())
                .join('-');
        }
        if (str2 !== str) {
            return str2;
        }

        // kebab-case to dot.notation
        if (/-/.test(str2)) {
            str2 = str2
                .split('-')
                .map((it) => it.toLocaleLowerCase())
                .join('.');
        }
        if (str2 !== str) {
            return str2;
        }

        // dot.notation to space separated
        if (/\.[a-z]/.test(str2)) {
            str2 = str2.replaceAll(/(\.)([a-z])/g, (_, _2, it) => ' ' + it);
        }
        if (str2 !== str) {
            return str2;
        }

        // space separated to Title Case
        if (/\s[a-z]/.test(str2)) {
            str2 = str2.replaceAll(/\s([a-z])/g, (_, it) => ' ' + it.toLocaleUpperCase());
            str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1);
        }
        if (str2 !== str) {
            return str2;
        }

        // Title Case to CamelCase
        if (/\s[A-Z]/.test(str2)) {
            str2 = str2.replaceAll(/\s([A-Z])/g, (_, it) => it);
            str2 = str2.substring(0, 1).toLocaleLowerCase() + str2.substring(1);
        }
        if (str2 !== str) {
            return str2;
        }

        // CamelCase to PascalCase
        if (/^[a-z]+[A-Z]+/.test(str2)) {
            str2 = str2.substring(0, 1).toLocaleUpperCase() + str2.substring(1);
        }
        if (str2 !== str) {
            return str2;
        }

        // PascalCase to snake_case
        if (/[^\s][A-Z]/.test(str2)) {
            str2 = str2.replaceAll(/[A-Z]/g, (it, offset) => {
                return (offset == 0 ? '' : '_') + it.toLocaleLowerCase();
            });
        }

        return str2;
    };
    useEffect(() => {
        textAreaRef.current.addEventListener('keydown', async (event) => {
            if (event.altKey && event.shiftKey && event.code === 'KeyU') {
                const originText = textAreaRef.current.value;
                const selectionStart = textAreaRef.current.selectionStart;
                const selectionEnd = textAreaRef.current.selectionEnd;
                const selectionText = originText.substring(selectionStart, selectionEnd);

                const convertedText = transformVarName(selectionText);
                const targetText =
                    originText.substring(0, selectionStart) + convertedText + originText.substring(selectionEnd);

                await changeSourceText(targetText);
                textAreaRef.current.selectionStart = selectionStart;
                textAreaRef.current.selectionEnd = selectionStart + convertedText.length;
            }
        });
    }, [textAreaRef]);

    const speakLabel = t(
        voice.status === 'loading' ? 'read_aloud.synthesizing' : voice.mine ? 'read_aloud.stop' : 'translate.speak'
    );

    return (
        <div className={cn('pb-2', hideSource && windowType !== '[INPUT_TRANSLATE]' && 'hidden')}>
            <div className='rounded-xl border bg-card text-card-foreground'>
                <div className='max-h-[40vh] overflow-y-auto px-4 pb-1 pt-3'>
                    <textarea
                        autoFocus
                        ref={textAreaRef}
                        className='block w-full resize-none bg-transparent text-base outline-none placeholder:text-muted-foreground'
                        value={sourceText}
                        onKeyDown={keyDown}
                        onChange={(e) => {
                            const v = e.target.value;
                            changeSourceText(v);
                        }}
                    />
                </div>
                <div className='flex items-center justify-between gap-2 px-2 pb-2'>
                    <div className='flex min-w-0 items-center gap-0.5'>
                        <ToolbarButton
                            label={speakLabel}
                            active={voice.mine}
                            onClick={() => {
                                voice
                                    .start(handleSpeak, playbackRate, (speech) => {
                                        if (speech.failures.length)
                                            toast.error(
                                                formatTtsFallbackNotice(speech.failures, speech.serviceLabel, t),
                                                { style: toastStyle, duration: 5000 }
                                            );
                                    })
                                    .catch((e) => {
                                        toast.error(
                                            e.failures
                                                ? formatTtsFallbackNotice(e.failures, null, t)
                                                : e.message ?? String(e),
                                            { style: toastStyle, duration: 5000 }
                                        );
                                    });
                            }}
                        >
                            {voice.status === 'loading' ? <Spinner /> : <Volume2 />}
                        </ToolbarButton>
                        <ToolbarButton
                            label={t('translate.copy')}
                            onClick={() => {
                                writeText(sourceText);
                            }}
                        >
                            <Copy />
                        </ToolbarButton>
                        <ToolbarButton
                            label={t('translate.delete_newline')}
                            onClick={() => {
                                const newText = sourceText.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                                setSourceText(newText);
                                detect_language(newText).then(() => {
                                    syncSourceText();
                                });
                            }}
                        >
                            <WrapText />
                        </ToolbarButton>
                        <ToolbarButton
                            label={t('common.clear')}
                            disabled={sourceText === ''}
                            onClick={() => {
                                setSourceText('');
                            }}
                        >
                            <Delete />
                        </ToolbarButton>
                        {detectLanguage !== '' && (
                            <Badge
                                variant='secondary'
                                className='ml-1 min-w-0 shrink'
                            >
                                <span className='truncate'>{t(`languages.${detectLanguage}`)}</span>
                            </Badge>
                        )}
                    </div>
                    <ToolbarButton
                        label={t('translate.translate')}
                        className='bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 hover:text-primary-foreground dark:hover:bg-primary/90'
                        onClick={() => {
                            detect_language(sourceText).then(() => {
                                syncSourceText();
                            });
                        }}
                    >
                        <Languages />
                    </ToolbarButton>
                </div>
                <TranslationReadAloudControls
                    voice={voice}
                    playbackRate={playbackRate}
                    setPlaybackRate={setPlaybackRate}
                />
            </div>
        </div>
    );
}
