import { checkUpdate, installUpdate } from '@tauri-apps/api/updater';
import React, { useEffect, useState } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { relaunch } from '@tauri-apps/api/process';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

import { Button } from '@/components/ui/button';
import { Progress, Skeleton, Spinner } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { useConfig, useToastStyle } from '../../hooks';
import { osType } from '../../utils/env';

let unlisten = 0;
let eventId = 0;

export default function Updater() {
    const [transparent] = useConfig('transparent', true);
    const [downloaded, setDownloaded] = useState(0);
    const [total, setTotal] = useState(0);
    const [body, setBody] = useState('');
    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    useEffect(() => {
        if (appWindow.label === 'updater') {
            appWindow.show();
        }
        checkUpdate().then(
            (update) => {
                if (update.shouldUpdate) {
                    setBody(update.manifest.body);
                } else {
                    setBody(t('updater.latest'));
                }
            },
            (e) => {
                setBody(e.toString());
                toast.error(e.toString(), { style: toastStyle });
            }
        );
        if (unlisten === 0) {
            unlisten = listen('tauri://update-download-progress', (e) => {
                if (eventId === 0) {
                    eventId = e.id;
                }
                if (e.id === eventId) {
                    setTotal(e.payload.contentLength);
                    setDownloaded((a) => {
                        return a + e.payload.chunkLength;
                    });
                }
            });
        }
    }, []);

    return (
        <div
            className={cn(
                'flex h-screen flex-col text-foreground',
                transparent ? 'bg-background/90' : 'bg-background',
                osType === 'Linux' && 'rounded-[10px] border'
            )}
        >
            <Toaster />
            <div className='h-10 w-full shrink-0 cursor-default select-none px-3 py-[5px]'>
                <div
                    data-tauri-drag-region='true'
                    className={cn('flex h-full w-full items-center gap-2', osType === 'Darwin' && 'justify-end')}
                >
                    <img
                        src='icon.png'
                        className='pointer-events-none size-5'
                        draggable={false}
                    />
                    <h2 className='pointer-events-none text-sm font-semibold'>{t('updater.title')}</h2>
                </div>
            </div>
            <div className='min-h-0 flex-1 px-2'>
                <div className='h-full overflow-y-auto rounded-xl border bg-card p-4 text-card-foreground shadow-xs'>
                    {body === '' ? (
                        <div className='space-y-3'>
                            <Skeleton className='h-3 w-3/5' />
                            <Skeleton className='h-3 w-4/5' />
                            <Skeleton className='h-3 w-2/5' />
                        </div>
                    ) : (
                        <ReactMarkdown
                            className='markdown-body select-text text-sm'
                            components={{
                                code: ({ node, ...props }) => {
                                    const { children } = props;
                                    return (
                                        <code className='rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs'>
                                            {children}
                                        </code>
                                    );
                                },
                                h2: ({ node, ...props }) => (
                                    <h2
                                        className='mb-3 border-b pb-2 text-xl font-semibold'
                                        {...props}
                                    />
                                ),
                                h3: ({ node, ...props }) => (
                                    <h3
                                        className='mb-2 mt-4 text-base font-semibold'
                                        {...props}
                                    />
                                ),
                                ul: ({ node, ...props }) => (
                                    <ul
                                        className='mb-2 space-y-1.5'
                                        {...props}
                                    />
                                ),
                                li: ({ node, ...props }) => {
                                    const { children } = props;
                                    return (
                                        <li
                                            className='list-disc list-inside'
                                            children={children}
                                        />
                                    );
                                },
                            }}
                        >
                            {body}
                        </ReactMarkdown>
                    )}
                </div>
            </div>
            {downloaded !== 0 && (
                <div className='px-3 pt-2'>
                    <div className='mb-1.5 flex items-center justify-between text-xs'>
                        <span className='text-muted-foreground'>{t('updater.progress')}</span>
                        <span className='tabular-nums font-medium'>
                            {Math.round(Math.min(100, (downloaded / total) * 100) || 0)}%
                        </span>
                    </div>
                    <Progress
                        aria-label='Downloading...'
                        className='h-1.5'
                        value={Math.min(100, (downloaded / total) * 100)}
                    />
                </div>
            )}

            <div className='flex shrink-0 justify-end gap-2 p-2'>
                <Button
                    variant='outline'
                    onClick={() => {
                        appWindow.close();
                    }}
                >
                    {t('updater.cancel')}
                </Button>
                <Button
                    disabled={downloaded !== 0}
                    onClick={() => {
                        installUpdate().then(
                            () => {
                                toast.success(t('updater.installed'), { style: toastStyle, duration: 10000 });
                                relaunch();
                            },
                            (e) => {
                                toast.error(e.toString(), { style: toastStyle });
                            }
                        );
                    }}
                >
                    {downloaded !== 0 ? <Spinner /> : <Download />}
                    {downloaded !== 0
                        ? downloaded > total
                            ? t('updater.installing')
                            : t('updater.downloading')
                        : t('updater.update')}
                </Button>
            </div>
        </div>
    );
}
