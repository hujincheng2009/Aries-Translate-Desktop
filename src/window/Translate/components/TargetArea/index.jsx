import ServiceIcon from '@/components/app/ServiceIcon';
import { ChevronDown, ChevronUp, Copy, RotateCcw, Undo2, Volume2 } from 'lucide-react';
import { sendNotification } from '@tauri-apps/api/notification';
import React, { useEffect, useState, useRef } from 'react';
import { writeText } from '@tauri-apps/api/clipboard';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Database from 'tauri-plugin-sql-api';
import {
    autoReadAloudAtom,
    getAutoReadRound,
    reportAutoReadResult,
    claimAutoRead,
    cancelAutoReadAloud,
} from '../../../../hooks/useAutoReadAloud';
import { filterAvailableServices } from '../../../../utils/service_availability';
import { useAtomValue } from 'jotai';
import { nanoid } from 'nanoid';
import { useSpring, animated } from '@react-spring/web';
import useMeasure from 'react-use-measure';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import ToolbarButton from '../../../../components/app/ToolbarButton';
import * as builtinCollectionServices from '../../../../services/collection';
import { sourceLanguageAtom, targetLanguageAtom } from '../LanguageArea';
import { useConfig, useToastStyle, useVoice } from '../../../../hooks';
import { useTranslationReadAloud } from '../../../../hooks/useTranslationReadAloud';
import { stopSelectionReadAloud } from '../../../../utils/selection_read_aloud_player';
import { useReadAloudPlaybackRate } from '../../../../hooks/useReadAloudPlaybackRate';
import TranslationReadAloudControls from '../../../../components/TranslationReadAloudControls';
import { normalizeReadAloudText, toReadAloudSpeechText } from '../../../../utils/read_aloud';
import { synthesizeWithFallback } from '../../../../utils/tts';
import { formatTtsFallbackNotice } from '../../../../utils/tts_fallback';
import { sourceTextAtom, detectLanguageAtom, ocrLanguageHintAtom } from '../SourceArea';
import { resolveOcrSourceLanguage } from '../../../../utils/ocr_language';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as builtinServices from '../../../../services/translate';
import {
    ON_DEMAND_TRANSLATE_SERVICE_LIST_KEY,
    createTranslationFingerprint,
    isCurrentTranslationRequest,
    isOnDemandService,
    shouldInvokeOnExpand,
    shouldPrepareTranslationContext,
} from '../../../../utils/on_demand_translation';

import { info, error as logError } from 'tauri-plugin-log-api';
import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getDisplayInstanceName,
    getServiceName,
    getServiceSouceType,
    whetherPluginService,
} from '../../../../utils/service_instance';

export default function TargetArea(props) {
    const {
        index,
        name,
        autoReadContext,
        translateServiceInstanceList,
        pluginList,
        serviceInstanceConfigMap,
        ...drag
    } = props;

    const [currentTranslateServiceInstanceKey, setCurrentTranslateServiceInstanceKey] = useState(name);
    function getInstanceName(instanceKey, serviceNameSupplier) {
        const instanceConfig = serviceInstanceConfigMap[instanceKey] ?? {};
        return getDisplayInstanceName(instanceConfig[INSTANCE_NAME_CONFIG_KEY], serviceNameSupplier);
    }

    const autoReadState = useAtomValue(autoReadAloudAtom);
    const lastAutoContextRef = useRef(null);
    const preparedEffectRef = useRef(null);
    const [storedCollectionServiceList] = useConfig('collection_service_list', []);
    const collectionServiceList = filterAvailableServices(
        storedCollectionServiceList,
        builtinCollectionServices,
        pluginList.collection
    );
    const [ttsServiceList] = useConfig('tts_service_list', ['lingva_tts']);
    const [translateSecondLanguage] = useConfig('translate_second_language', 'en');
    const [onDemandServiceInstanceList] = useConfig(ON_DEMAND_TRANSLATE_SERVICE_LIST_KEY, []);
    const [historyDisable] = useConfig('history_disable', false);
    const [isLoading, setIsLoading] = useState(false);
    const [hide, setHide] = useState(true);

    const [result, setResult] = useState('');
    const [error, setError] = useState('');

    const sourceText = useAtomValue(sourceTextAtom);
    const selectedSourceLanguage = useAtomValue(sourceLanguageAtom);
    const ocrLanguageHint = useAtomValue(ocrLanguageHintAtom);
    const [followOcrLanguage] = useConfig('translate_follow_ocr_language', false);
    const sourceLanguage = resolveOcrSourceLanguage(
        selectedSourceLanguage,
        sourceText,
        ocrLanguageHint,
        followOcrLanguage
    );
    const targetLanguage = useAtomValue(targetLanguageAtom);
    const currentFingerprint = createTranslationFingerprint(
        sourceText,
        sourceLanguage,
        targetLanguage,
        currentTranslateServiceInstanceKey
    );
    const currentFingerprintRef = useRef(currentFingerprint);
    const requestGenerationRef = useRef(0);
    const requestedFingerprintRef = useRef(null);
    const lastOnDemandFingerprintRef = useRef(null);
    currentFingerprintRef.current = currentFingerprint;
    const onDemand = isOnDemandService(onDemandServiceInstanceList, currentTranslateServiceInstanceKey);
    const onDemandConfigReady = onDemandServiceInstanceList !== null;
    const [autoCopy] = useConfig('translate_auto_copy', 'disable');
    const [hideWindow] = useConfig('translate_hide_window', false);
    const [clipboardMonitor] = useConfig('clipboard_monitor', false);

    const detectLanguage = useAtomValue(detectLanguageAtom);
    const { t } = useTranslation();
    const textAreaRef = useRef();
    const toastStyle = useToastStyle();
    const speak = useVoice();
    const voice = useTranslationReadAloud(`target:${name}`, typeof result === 'string' ? result : '');
    const [playbackRate, setPlaybackRate] = useReadAloudPlaybackRate();
    useEffect(() => {
        if (hide && voice.mine) voice.stop();
    }, [hide]);

    useEffect(() => {
        return () => {
            currentFingerprintRef.current = null;
            requestGenerationRef.current += 1;
        };
    }, []);

    useEffect(() => {
        if (error) {
            logError(`[${currentTranslateServiceInstanceKey}]happened error: ` + error);
        }
    }, [error]);

    // listen to translation
    useEffect(() => {
        const configReady =
            autoCopy !== null && hideWindow !== null && clipboardMonitor !== null && onDemandConfigReady;
        if (!configReady || getAutoReadRound(autoReadContext) === null) return;
        const effectKey = JSON.stringify([
            currentFingerprint,
            autoReadContext,
            autoCopy,
            hideWindow,
            clipboardMonitor,
            onDemand,
        ]);
        if (preparedEffectRef.current === effectKey) return;
        preparedEffectRef.current = effectKey;
        const newAutoContext = lastAutoContextRef.current !== autoReadContext;
        lastAutoContextRef.current = autoReadContext;
        if (!newAutoContext) reportAutoReadResult(autoReadContext, getAutoReadRound(autoReadContext), name, 'skipped');
        if (!shouldPrepareTranslationContext(onDemand, currentFingerprint, lastOnDemandFingerprintRef.current)) {
            return;
        }

        lastOnDemandFingerprintRef.current = onDemand ? currentFingerprint : null;
        // A render can change the context before this effect runs. Invalidate the old
        // request immediately and clear the one-entry cache for the new fingerprint.
        requestGenerationRef.current += 1;
        requestedFingerprintRef.current = null;
        setResult('');
        setError('');
        setIsLoading(false);
        if (sourceText.trim() !== '' && sourceLanguage && targetLanguage && configReady) {
            if (autoCopy === 'source' && !clipboardMonitor) {
                writeText(sourceText).then(() => {
                    if (hideWindow) {
                        sendNotification({ title: t('common.write_clipboard'), body: sourceText });
                    }
                });
            }
            if (onDemand) {
                setHide(true);
            } else {
                translate({
                    fingerprint: currentFingerprint,
                    autoExpand: true,
                    autoReadRound: newAutoContext ? getAutoReadRound(autoReadContext) : null,
                });
            }
        }
    }, [
        sourceText,
        sourceLanguage,
        targetLanguage,
        autoCopy,
        hideWindow,
        currentTranslateServiceInstanceKey,
        clipboardMonitor,
        onDemand,
        onDemandConfigReady,
        autoReadContext,
        autoReadState.context,
    ]);

    // todo: history panel use service instance key
    const addToHistory = async (text, source, target, serviceInstanceKey, result) => {
        const db = await Database.load('sqlite:history.db');

        await db
            .execute(
                'INSERT into history (text, source, target, service, result, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
                [text, source, target, serviceInstanceKey, result, Date.now()]
            )
            .then(
                (v) => {
                    db.close();
                },
                (e) => {
                    db.execute(
                        'CREATE TABLE history(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL,source TEXT NOT NULL,target TEXT NOT NULL,service TEXT NOT NULL, result TEXT NOT NULL,timestamp INTEGER NOT NULL)'
                    ).then(() => {
                        db.close();
                        addToHistory(text, source, target, serviceInstanceKey, result);
                    });
                }
            );
    };

    function invokeOnce(fn) {
        let isInvoke = false;

        return (...args) => {
            if (isInvoke) {
                return;
            } else {
                fn(...args);
                isInvoke = true;
            }
        };
    }

    const translate = async ({
        fingerprint = currentFingerprint,
        autoExpand = !onDemand,
        autoReadRound = null,
    } = {}) => {
        const reportFinal = (status, text = '') => {
            if (autoReadRound !== null)
                reportAutoReadResult(
                    autoReadContext,
                    autoReadRound,
                    name,
                    status,
                    typeof text === 'string' ? text.trim() : ''
                );
        };
        const requestGeneration = ++requestGenerationRef.current;
        requestedFingerprintRef.current = fingerprint;
        const requestServiceInstanceKey = currentTranslateServiceInstanceKey;
        const requestSourceText = sourceText.trim();
        const requestSourceLanguage = sourceLanguage;
        const requestTargetLanguage = targetLanguage;
        const requestDetectLanguage = detectLanguage;
        const translateServiceName = getServiceName(requestServiceInstanceKey);
        const requestIsCurrent = () =>
            isCurrentTranslationRequest(
                currentFingerprintRef.current,
                fingerprint,
                requestGenerationRef.current,
                requestGeneration
            );
        const revealResultOnce = invokeOnce(() => {
            if (autoExpand) {
                setHide(false);
            }
        });

        setResult('');
        setError('');

        try {
            if (whetherPluginService(requestServiceInstanceKey)) {
                const pluginInfo = pluginList['translate'][translateServiceName];
                if (requestSourceLanguage in pluginInfo.language && requestTargetLanguage in pluginInfo.language) {
                    let newTargetLanguage = requestTargetLanguage;
                    if (selectedSourceLanguage === 'auto' && requestTargetLanguage === requestDetectLanguage) {
                        newTargetLanguage = translateSecondLanguage;
                    }
                    setIsLoading(true);
                    if (autoExpand) {
                        setHide(true);
                    }
                    const instanceConfig = {
                        ...(serviceInstanceConfigMap[requestServiceInstanceKey] ?? {}),
                        enable: 'true',
                    };
                    let [func, utils] = await invoke_plugin('translate', translateServiceName);
                    if (!requestIsCurrent()) return;
                    func(
                        requestSourceText,
                        pluginInfo.language[requestSourceLanguage],
                        pluginInfo.language[newTargetLanguage],
                        {
                            config: instanceConfig,
                            detect: requestDetectLanguage,
                            setResult: (v) => {
                                if (!requestIsCurrent()) return;
                                setResult(v);
                                revealResultOnce();
                            },
                            utils,
                        }
                    ).then(
                        (v) => {
                            info(`[${requestServiceInstanceKey}]resolve:` + v);
                            if (!requestIsCurrent()) return;
                            setResult(typeof v === 'string' ? v.trim() : v);
                            setIsLoading(false);
                            reportFinal('success', v);
                            if (v !== '') {
                                revealResultOnce();
                            }
                            if (!historyDisable) {
                                addToHistory(
                                    requestSourceText,
                                    requestDetectLanguage,
                                    newTargetLanguage,
                                    translateServiceName,
                                    typeof v === 'string' ? v.trim() : v
                                );
                            }
                            if (index === 0 && !clipboardMonitor) {
                                switch (autoCopy) {
                                    case 'target':
                                        writeText(v).then(() => {
                                            if (hideWindow) {
                                                sendNotification({ title: t('common.write_clipboard'), body: v });
                                            }
                                        });
                                        break;
                                    case 'source_target':
                                        writeText(requestSourceText + '\n\n' + v).then(() => {
                                            if (hideWindow) {
                                                sendNotification({
                                                    title: t('common.write_clipboard'),
                                                    body: requestSourceText + '\n\n' + v,
                                                });
                                            }
                                        });
                                        break;
                                    default:
                                        break;
                                }
                            }
                        },
                        (e) => {
                            info(`[${requestServiceInstanceKey}]reject:` + e);
                            if (!requestIsCurrent()) return;
                            setError(e.toString());
                            setIsLoading(false);
                            reportFinal('error');
                        }
                    );
                } else {
                    if (requestIsCurrent()) {
                        setError('Language not supported');
                        setIsLoading(false);
                        reportFinal('error');
                    }
                }
            } else {
                const LanguageEnum = builtinServices[translateServiceName].Language;
                if (requestSourceLanguage in LanguageEnum && requestTargetLanguage in LanguageEnum) {
                    let newTargetLanguage = requestTargetLanguage;
                    if (selectedSourceLanguage === 'auto' && requestTargetLanguage === requestDetectLanguage) {
                        newTargetLanguage = translateSecondLanguage;
                    }
                    setIsLoading(true);
                    if (autoExpand) {
                        setHide(true);
                    }
                    const instanceConfig = serviceInstanceConfigMap[requestServiceInstanceKey];
                    builtinServices[translateServiceName]
                        .translate(
                            requestSourceText,
                            LanguageEnum[requestSourceLanguage],
                            LanguageEnum[newTargetLanguage],
                            {
                                config: instanceConfig,
                                detect: requestDetectLanguage,
                                shouldContinue: requestIsCurrent,
                                setResult: (v) => {
                                    if (!requestIsCurrent()) return;
                                    setResult(v);
                                    revealResultOnce();
                                },
                            }
                        )
                        .then(
                            (v) => {
                                info(`[${requestServiceInstanceKey}]resolve:` + v);
                                if (!requestIsCurrent()) return;
                                setResult(typeof v === 'string' ? v.trim() : v);
                                setIsLoading(false);
                                reportFinal('success', v);
                                if (v !== '') {
                                    revealResultOnce();
                                }
                                if (!historyDisable) {
                                    addToHistory(
                                        requestSourceText,
                                        requestDetectLanguage,
                                        newTargetLanguage,
                                        translateServiceName,
                                        typeof v === 'string' ? v.trim() : v
                                    );
                                }
                                if (index === 0 && !clipboardMonitor) {
                                    switch (autoCopy) {
                                        case 'target':
                                            writeText(v).then(() => {
                                                if (hideWindow) {
                                                    sendNotification({ title: t('common.write_clipboard'), body: v });
                                                }
                                            });
                                            break;
                                        case 'source_target':
                                            writeText(requestSourceText + '\n\n' + v).then(() => {
                                                if (hideWindow) {
                                                    sendNotification({
                                                        title: t('common.write_clipboard'),
                                                        body: requestSourceText + '\n\n' + v,
                                                    });
                                                }
                                            });
                                            break;
                                        default:
                                            break;
                                    }
                                }
                            },
                            (e) => {
                                info(`[${requestServiceInstanceKey}]reject:` + e);
                                if (!requestIsCurrent()) return;
                                setError(e.toString());
                                setIsLoading(false);
                                reportFinal('error');
                            }
                        );
                } else {
                    if (requestIsCurrent()) {
                        setError('Language not supported');
                        setIsLoading(false);
                        reportFinal('error');
                    }
                }
            }
        } catch (e) {
            info(`[${requestServiceInstanceKey}]reject:` + e);
            if (!requestIsCurrent()) return;
            setError(e.toString());
            setIsLoading(false);
            reportFinal('error');
        }
    };

    // hide empty textarea
    useEffect(() => {
        if (textAreaRef.current !== null) {
            textAreaRef.current.style.height = '0px';
            if (result !== '') {
                textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px';
            }
        }
    }, [result]);

    // handle tts speak
    const handleSpeak = async (shouldContinue) => {
        const speechText = toReadAloudSpeechText(normalizeReadAloudText(result));
        return synthesizeWithFallback({
            text: speechText,
            serviceInstanceList: ttsServiceList,
            getConfig: (instanceKey) => serviceInstanceConfigMap[instanceKey] ?? {},
            shouldContinue,
            language: { mode: 'fixed', language: targetLanguage },
        });
    };

    useEffect(() => {
        if (
            !hide &&
            !isLoading &&
            typeof result === 'string' &&
            result.trim() &&
            claimAutoRead(autoReadContext, name)
        ) {
            void voice
                .start(
                    handleSpeak,
                    playbackRate,
                    (speech) => {
                        if (speech.failures.length)
                            toast.error(formatTtsFallbackNotice(speech.failures, speech.serviceLabel, t), {
                                style: toastStyle,
                                duration: 5000,
                            });
                    },
                    { automatic: true }
                )
                .catch((e) =>
                    toast.error(e.failures ? formatTtsFallbackNotice(e.failures, null, t) : e.message ?? String(e), {
                        style: toastStyle,
                    })
                );
        }
    }, [autoReadState, autoReadContext, result, hide, isLoading]);

    const [boundRef, bounds] = useMeasure({ scroll: true });
    const springs = useSpring({
        from: { height: 0 },
        to: { height: hide ? 0 : bounds.height },
    });

    const toggleContent = () => {
        if (!hide) {
            voice.stop();
            setHide(true);
            return;
        }

        setHide(false);
        const hasValidContext = sourceText.trim() !== '' && sourceLanguage && targetLanguage;
        if (hasValidContext && shouldInvokeOnExpand(onDemand, currentFingerprint, requestedFingerprintRef.current)) {
            translate({ fingerprint: currentFingerprint, autoExpand: false });
        }
    };

    const translateBack = async () => {
        setError('');
        let newTargetLanguage = sourceLanguage;
        if (sourceLanguage === 'auto') {
            newTargetLanguage = detectLanguage;
        }
        let newSourceLanguage = targetLanguage;
        if (sourceLanguage === 'auto') {
            newSourceLanguage = 'auto';
        }
        if (whetherPluginService(currentTranslateServiceInstanceKey)) {
            const pluginInfo = pluginList['translate'][getServiceName(currentTranslateServiceInstanceKey)];
            if (newSourceLanguage in pluginInfo.language && newTargetLanguage in pluginInfo.language) {
                setIsLoading(true);
                setHide(true);
                const instanceConfig = serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
                instanceConfig['enable'] = 'true';
                const setHideOnce = invokeOnce(setHide);
                let [func, utils] = await invoke_plugin(
                    'translate',
                    getServiceName(currentTranslateServiceInstanceKey)
                );
                func(result.trim(), pluginInfo.language[newSourceLanguage], pluginInfo.language[newTargetLanguage], {
                    config: instanceConfig,
                    detect: detectLanguage,
                    setResult: (v) => {
                        setResult(v);
                        setHideOnce(false);
                    },
                    utils,
                }).then(
                    (v) => {
                        if (v === result) {
                            setResult(v + ' ');
                        } else {
                            setResult(v.trim());
                        }
                        setIsLoading(false);
                        if (v !== '') {
                            setHideOnce(false);
                        }
                    },
                    (e) => {
                        setError(e.toString());
                        setIsLoading(false);
                    }
                );
            } else {
                setError('Language not supported');
            }
        } else {
            const LanguageEnum = builtinServices[getServiceName(currentTranslateServiceInstanceKey)].Language;
            if (newSourceLanguage in LanguageEnum && newTargetLanguage in LanguageEnum) {
                setIsLoading(true);
                setHide(true);
                const instanceConfig = serviceInstanceConfigMap[currentTranslateServiceInstanceKey];
                const setHideOnce = invokeOnce(setHide);
                builtinServices[getServiceName(currentTranslateServiceInstanceKey)]
                    .translate(result.trim(), LanguageEnum[newSourceLanguage], LanguageEnum[newTargetLanguage], {
                        config: instanceConfig,
                        detect: newSourceLanguage,
                        setResult: (v) => {
                            setResult(v);
                            setHideOnce(false);
                        },
                    })
                    .then(
                        (v) => {
                            if (v === result) {
                                setResult(v + ' ');
                            } else {
                                setResult(v.trim());
                            }
                            setIsLoading(false);
                            if (v !== '') {
                                setHideOnce(false);
                            }
                        },
                        (e) => {
                            setError(e.toString());
                            setIsLoading(false);
                        }
                    );
            } else {
                setError('Language not supported');
            }
        }
    };

    const addToCollection = async (collectionServiceInstanceName) => {
        if (getServiceSouceType(collectionServiceInstanceName) === ServiceSourceType.PLUGIN) {
            const pluginConfig = serviceInstanceConfigMap[collectionServiceInstanceName];
            let [func, utils] = await invoke_plugin('collection', getServiceName(collectionServiceInstanceName));
            func(sourceText.trim(), result.toString(), {
                config: pluginConfig,
                utils,
            }).then(
                (_) => {
                    toast.success(t('translate.add_collection_success'), {
                        style: toastStyle,
                    });
                },
                (e) => {
                    toast.error(e.toString(), { style: toastStyle });
                }
            );
        } else {
            const instanceConfig = serviceInstanceConfigMap[collectionServiceInstanceName];
            builtinCollectionServices[getServiceName(collectionServiceInstanceName)]
                .collection(sourceText, result, {
                    config: instanceConfig,
                })
                .then(
                    (_) => {
                        toast.success(t('translate.add_collection_success'), {
                            style: toastStyle,
                        });
                    },
                    (e) => {
                        toast.error(e.toString(), { style: toastStyle });
                    }
                );
        }
    };

    const isMonochromeService = (instanceKey) =>
        !whetherPluginService(instanceKey) && builtinServices[getServiceName(instanceKey)]?.info.iconMonochrome;
    const getServiceIcon = (instanceKey) =>
        whetherPluginService(instanceKey)
            ? pluginList['translate'][getServiceName(instanceKey)].icon
            : builtinServices[getServiceName(instanceKey)].info.icon;
    const getServiceLabel = (instanceKey) =>
        whetherPluginService(instanceKey)
            ? getInstanceName(instanceKey, () => pluginList['translate'][getServiceName(instanceKey)].display)
            : getInstanceName(instanceKey, () => t(`services.translate.${getServiceName(instanceKey)}.title`));
    const getCollectionIcon = (instanceKey) =>
        getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
            ? pluginList['collection'][getServiceName(instanceKey)].icon
            : builtinCollectionServices[getServiceName(instanceKey)].info.icon;
    const getCollectionLabel = (instanceKey) =>
        getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN
            ? getInstanceName(instanceKey, () => pluginList['collection'][getServiceName(instanceKey)].display)
            : getInstanceName(instanceKey, () => t(`services.collection.${getServiceName(instanceKey)}.title`));

    const hasTextResult = typeof result === 'string' && result !== '';
    const speakLabel = t(
        voice.status === 'loading' ? 'read_aloud.synthesizing' : voice.mine ? 'read_aloud.stop' : 'translate.speak'
    );

    return (
        <div className='overflow-hidden rounded-xl border bg-card text-card-foreground'>
            <div
                className='flex h-11 items-center justify-between gap-2 px-2'
                {...drag}
            >
                {/* current service instance and available service instance to change */}
                <div className='flex min-w-0 items-center gap-2'>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant='ghost'
                                size='sm'
                                aria-label={t('translate.select_service')}
                                className='min-w-0 gap-2 px-2'
                            >
                                <ServiceIcon
                                    src={getServiceIcon(currentTranslateServiceInstanceKey)}
                                    iconMonochrome={isMonochromeService(currentTranslateServiceInstanceKey)}
                                    className='size-4 shrink-0 object-contain'
                                    draggable={false}
                                />
                                <span className='truncate'>{getServiceLabel(currentTranslateServiceInstanceKey)}</span>
                                <ChevronDown className='text-muted-foreground' />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align='start'
                            aria-label={t('translate.select_service')}
                            className='max-h-[min(40vh,var(--radix-dropdown-menu-content-available-height))]'
                        >
                            <DropdownMenuRadioGroup
                                value={currentTranslateServiceInstanceKey}
                                onValueChange={setCurrentTranslateServiceInstanceKey}
                            >
                                {translateServiceInstanceList.map((instanceKey) => (
                                    <DropdownMenuRadioItem
                                        key={instanceKey}
                                        value={instanceKey}
                                    >
                                        <ServiceIcon
                                            src={getServiceIcon(instanceKey)}
                                            iconMonochrome={isMonochromeService(instanceKey)}
                                            className='size-4 shrink-0 object-contain'
                                            draggable={false}
                                        />
                                        {getServiceLabel(instanceKey)}
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {isLoading && <Spinner className='text-muted-foreground' />}
                </div>
                {/* content collapse */}
                <ToolbarButton
                    label={t(hide ? 'translate.expand' : 'translate.collapse')}
                    aria-expanded={!hide}
                    onClick={toggleContent}
                >
                    {hide ? <ChevronDown /> : <ChevronUp />}
                </ToolbarButton>
            </div>
            <animated.div style={{ ...springs, overflow: 'hidden' }}>
                <div ref={boundRef}>
                    {/* result content */}
                    <div
                        data-selection-read-aloud={targetLanguage}
                        className={cn('flex flex-col px-4 pb-1 pt-0.5 text-base', hide && 'h-0 p-0')}
                    >
                        {typeof result === 'string' ? (
                            <textarea
                                ref={textAreaRef}
                                className='h-0 w-full select-text resize-none bg-transparent outline-none'
                                readOnly
                                value={result}
                            />
                        ) : (
                            <div>
                                {result['pronunciations'] &&
                                    result['pronunciations'].map((pronunciation) => {
                                        return (
                                            <div
                                                key={nanoid()}
                                                className='flex items-center'
                                            >
                                                {pronunciation['region'] && (
                                                    <span className='mr-3 text-muted-foreground'>
                                                        {pronunciation['region']}
                                                    </span>
                                                )}
                                                {pronunciation['symbol'] && (
                                                    <span className='mr-3 text-muted-foreground'>
                                                        {pronunciation['symbol']}
                                                    </span>
                                                )}
                                                {pronunciation['voice'] && pronunciation['voice'] !== '' && (
                                                    <Button
                                                        variant='ghost'
                                                        size='icon-xs'
                                                        aria-label={t('translate.speak')}
                                                        className='text-muted-foreground hover:text-foreground'
                                                        onClick={() => {
                                                            voice.stop();
                                                            cancelAutoReadAloud();
                                                            stopSelectionReadAloud();
                                                            speak(pronunciation['voice']);
                                                        }}
                                                    >
                                                        <Volume2 className='size-[1em]' />
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                {result['explanations'] &&
                                    result['explanations'].map((explanations) => {
                                        return (
                                            <div key={nanoid()}>
                                                {explanations['explains'] &&
                                                    explanations['explains'].map((explain, index) => {
                                                        return (
                                                            <span key={nanoid()}>
                                                                {index === 0 ? (
                                                                    <>
                                                                        <span className='mr-3 text-sm text-muted-foreground'>
                                                                            {explanations['trait']}
                                                                        </span>
                                                                        <span className='select-text font-bold'>
                                                                            {explain}
                                                                        </span>
                                                                        <br />
                                                                    </>
                                                                ) : (
                                                                    <span
                                                                        className='mr-1 select-text text-sm text-muted-foreground'
                                                                        key={nanoid()}
                                                                    >
                                                                        {explain}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                            </div>
                                        );
                                    })}
                                <br />
                                {result['associations'] &&
                                    result['associations'].map((association) => {
                                        return (
                                            <div key={nanoid()}>
                                                <span className='text-muted-foreground'>{association}</span>
                                            </div>
                                        );
                                    })}
                                {result['sentence'] &&
                                    result['sentence'].map((sentence, index) => {
                                        return (
                                            <div key={nanoid()}>
                                                <span className='mr-3 text-sm'>{index + 1}.</span>
                                                <>
                                                    {sentence['source'] && (
                                                        <span
                                                            className='select-text'
                                                            dangerouslySetInnerHTML={{
                                                                __html: sentence['source'],
                                                            }}
                                                        />
                                                    )}
                                                </>
                                                <>
                                                    {sentence['target'] && (
                                                        <div
                                                            className='select-text text-muted-foreground'
                                                            dangerouslySetInnerHTML={{
                                                                __html: sentence['target'],
                                                            }}
                                                        />
                                                    )}
                                                </>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                        {error !== '' ? (
                            error.split('\n').map((v) => {
                                return (
                                    <p
                                        key={v}
                                        className='select-text break-words text-destructive'
                                    >
                                        {v}
                                    </p>
                                );
                            })
                        ) : (
                            <></>
                        )}
                    </div>
                    <div className={cn('flex flex-wrap items-center gap-0.5 px-2 pb-2', hide && 'hidden')}>
                        {/* speak button */}
                        <ToolbarButton
                            label={speakLabel}
                            active={voice.mine}
                            disabled={!hasTextResult}
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
                        {/* copy button */}
                        <ToolbarButton
                            label={t('translate.copy')}
                            disabled={!hasTextResult}
                            onClick={() => {
                                writeText(result);
                            }}
                        >
                            <Copy />
                        </ToolbarButton>
                        {/* translate back button */}
                        <ToolbarButton
                            label={t('translate.translate_back')}
                            disabled={
                                !hasTextResult ||
                                (sourceLanguage === 'auto' && (!detectLanguage || detectLanguage === 'auto'))
                            }
                            onClick={translateBack}
                        >
                            <Undo2 />
                        </ToolbarButton>
                        {/* error retry button */}
                        {error !== '' && (
                            <ToolbarButton
                                label={t('translate.retry')}
                                onClick={() => {
                                    translate({ fingerprint: currentFingerprint, autoExpand: !onDemand });
                                }}
                            >
                                <RotateCcw />
                            </ToolbarButton>
                        )}
                        {/* available collection service instance */}
                        {collectionServiceList &&
                            collectionServiceList.map((collectionServiceInstanceName) => (
                                <ToolbarButton
                                    key={collectionServiceInstanceName}
                                    label={getCollectionLabel(collectionServiceInstanceName)}
                                    onClick={() => addToCollection(collectionServiceInstanceName)}
                                >
                                    <img
                                        src={getCollectionIcon(collectionServiceInstanceName)}
                                        className='size-4 object-contain'
                                        draggable={false}
                                    />
                                </ToolbarButton>
                            ))}
                    </div>
                    <TranslationReadAloudControls
                        voice={voice}
                        playbackRate={playbackRate}
                        setPlaybackRate={setPlaybackRate}
                    />
                </div>
            </animated.div>
        </div>
    );
}
