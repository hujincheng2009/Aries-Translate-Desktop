import { sendNotification } from '@tauri-apps/api/notification';
import { writeText } from '@tauri-apps/api/clipboard';
import { atom, useAtom, useAtomValue } from 'jotai';
import React, { useEffect, useState } from 'react';
import { Copy, Space, WrapText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';

import { Skeleton } from '@/components/ui/misc';
import ToolbarButton from '../../../components/app/ToolbarButton';
import { getServiceName, getServiceSouceType, ServiceSourceType } from '../../../utils/service_instance';
import { currentServiceInstanceKeyAtom, languageAtom, recognizeFlagAtom } from '../ControlArea';
import { invoke_plugin } from '../../../utils/invoke_plugin';
import * as builtinServices from '../../../services/recognize';
import { useConfig } from '../../../hooks';
import { base64Atom } from '../ImageArea';
import { pluginListAtom } from '..';

export const textAtom = atom();
let recognizeId = 0;

export default function TextArea(props) {
    const { serviceInstanceConfigMap } = props;
    const [autoCopy] = useConfig('recognize_auto_copy', false);
    const [deleteNewline] = useConfig('recognize_delete_newline', false);
    const [hideWindow] = useConfig('recognize_hide_window', false);
    const recognizeFlag = useAtomValue(recognizeFlagAtom);
    const currentServiceInstanceKey = useAtomValue(currentServiceInstanceKeyAtom);
    const language = useAtomValue(languageAtom);
    const base64 = useAtomValue(base64Atom);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useAtom(textAtom);
    const [error, setError] = useState('');
    const pluginList = useAtomValue(pluginListAtom);
    const { t } = useTranslation();

    useEffect(() => {
        setText('');
        setError('');
        if (
            base64 !== '' &&
            currentServiceInstanceKey &&
            autoCopy !== null &&
            deleteNewline !== null &&
            hideWindow !== null
        ) {
            setLoading(true);
            if (getServiceSouceType(currentServiceInstanceKey) === ServiceSourceType.PLUGIN) {
                if (language in pluginList[getServiceName(currentServiceInstanceKey)].language) {
                    let id = nanoid();
                    recognizeId = id;
                    const pluginConfig = serviceInstanceConfigMap[currentServiceInstanceKey] ?? {};

                    invoke_plugin('recognize', getServiceName(currentServiceInstanceKey)).then(([func, utils]) => {
                        func(base64, pluginList[getServiceName(currentServiceInstanceKey)].language[language], {
                            config: pluginConfig,
                            utils,
                        }).then(
                            (v) => {
                                if (recognizeId !== id) return;
                                v = v.trim();
                                if (deleteNewline) {
                                    v = v.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                                }
                                setText(v);
                                setLoading(false);
                                if (autoCopy) {
                                    writeText(v).then(() => {
                                        if (hideWindow) {
                                            sendNotification({
                                                title: t('common.write_clipboard'),
                                                body: v,
                                            });
                                        }
                                    });
                                }
                            },
                            (e) => {
                                if (recognizeId !== id) return;
                                setError(e.toString());
                                setLoading(false);
                            }
                        );
                    });
                }
            } else {
                const instanceConfig = serviceInstanceConfigMap[currentServiceInstanceKey] ?? {};
                if (language in builtinServices[getServiceName(currentServiceInstanceKey)].Language) {
                    let id = nanoid();
                    recognizeId = id;
                    builtinServices[getServiceName(currentServiceInstanceKey)]
                        .recognize(
                            base64,
                            builtinServices[getServiceName(currentServiceInstanceKey)].Language[language],
                            {
                                config: instanceConfig,
                            }
                        )
                        .then(
                            (v) => {
                                if (recognizeId !== id) return;
                                v = v.trim();
                                if (deleteNewline) {
                                    v = v.replace(/\-\s+/g, '').replace(/\s+/g, ' ');
                                }
                                setText(v);
                                setLoading(false);
                                if (autoCopy) {
                                    writeText(v).then(() => {
                                        if (hideWindow) {
                                            sendNotification({
                                                title: t('common.write_clipboard'),
                                                body: v,
                                            });
                                        }
                                    });
                                }
                            },
                            (e) => {
                                if (recognizeId !== id) return;
                                setError(e.toString());
                                setLoading(false);
                            }
                        );
                } else {
                    setError('Language not supported');
                    setLoading(false);
                }
            }
        }
    }, [base64, currentServiceInstanceKey, language, recognizeFlag, autoCopy, deleteNewline, hideWindow]);

    return (
        <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs'>
            <div className='relative min-h-0 flex-1'>
                {loading ? (
                    <div className='space-y-3 p-4'>
                        <Skeleton className='h-3 w-3/5' />
                        <Skeleton className='h-3 w-4/5' />
                        <Skeleton className='h-3 w-2/5' />
                    </div>
                ) : (
                    <>
                        {text && (
                            <textarea
                                value={text}
                                className='absolute inset-0 size-full resize-none bg-transparent p-4 text-sm outline-none'
                                onChange={(e) => {
                                    setText(e.target.value);
                                }}
                            />
                        )}
                        {error && (
                            <textarea
                                value={error}
                                readOnly
                                className='absolute inset-0 size-full resize-none bg-transparent p-4 text-sm text-destructive outline-none'
                                onChange={(e) => {
                                    setText(e.target.value);
                                }}
                            />
                        )}
                    </>
                )}
            </div>
            <div className='flex items-center justify-start gap-0.5 border-t p-2'>
                <ToolbarButton
                    label={t('recognize.copy_text')}
                    onClick={() => {
                        writeText(text);
                    }}
                >
                    <Copy />
                </ToolbarButton>
                <ToolbarButton
                    label={t('recognize.delete_newline')}
                    onClick={() => {
                        setText(text.replace(/\-\s+/g, '').replace(/\s+/g, ' '));
                    }}
                >
                    <WrapText />
                </ToolbarButton>
                <ToolbarButton
                    label={t('recognize.delete_space')}
                    onClick={() => {
                        setText(text.replaceAll(' ', ''));
                    }}
                >
                    <Space />
                </ToolbarButton>
            </div>
        </div>
    );
}
