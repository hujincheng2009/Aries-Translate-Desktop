import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';
import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast, { Toaster } from 'react-hot-toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/misc';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import WindowDragRegion from '../../components/app/WindowDragRegion';
import ReadAloudVolumeControl from '../../components/app/ReadAloudVolumeControl';
import ToolbarButton from '../../components/app/ToolbarButton';
import WindowControl from '../../components/WindowControl';
import ReadAloudProgress from '../../components/ReadAloudProgress';
import { useReadAloudPlaybackRate } from '../../hooks/useReadAloudPlaybackRate';
import { useReadAloudProgress } from '../../hooks/useReadAloudProgress';
import { useToastStyle } from '../../hooks/useToastStyle';
import { formatTtsFallbackNotice } from '../../utils/tts_fallback';
import {
    formatReadAloudPlaybackRate,
    isCurrentReadAloudPlayback,
    normalizeReadAloudText,
    READ_ALOUD_PLAYBACK_RATES,
    READ_ALOUD_RATE_BUTTON_WIDTH,
    READ_ALOUD_SERVICE_CHIP_MAX_WIDTH,
    shouldHandleReadAloudRequest,
    shouldShowReadAloudStatus,
} from '../../utils/read_aloud';
import {
    pauseReadAloudVoice,
    playReadAloudVoice,
    replayReadAloudVoice,
    resumeReadAloudVoice,
    seekReadAloudVoice,
    stopReadAloudVoice,
} from '../../utils/read_aloud_player';
import { synthesizeWithDefaultTts } from '../../utils/tts';

export default function ReadAloud() {
    const [text, setText] = useState('');
    const [status, setStatus] = useState('idle');
    const [language, setLanguage] = useState('');
    const [serviceName, setServiceName] = useState('');
    const [error, setError] = useState('');
    const [playbackRate, setPlaybackRate] = useReadAloudPlaybackRate();
    const [progress, refreshProgress] = useReadAloudProgress(status);
    const latestRequestIdRef = useRef(0);
    const playbackSessionRef = useRef(0);
    const playbackRateRef = useRef(playbackRate);
    playbackRateRef.current = playbackRate;
    const audioDataRef = useRef(null);
    const { t, i18n } = useTranslation();
    const toastStyle = useToastStyle();
    const tRef = useRef(t);
    const toastStyleRef = useRef(toastStyle);
    tRef.current = t;
    toastStyleRef.current = toastStyle;

    useEffect(() => {
        void appWindow.setTitle(`Aries ${t('read_aloud.title')}`);
    }, [i18n.language, t]);

    const isCurrentPlayback = (requestId, playbackSession) =>
        isCurrentReadAloudPlayback(latestRequestIdRef.current, playbackSessionRef.current, requestId, playbackSession);

    const playAudio = async (data, requestId, playbackSession) => {
        setStatus('loading');
        await playReadAloudVoice(data, {
            playbackRate: playbackRateRef.current,
            onStarted: () => {
                if (isCurrentPlayback(requestId, playbackSession)) setStatus('playing');
            },
            onEnded: () => {
                if (isCurrentPlayback(requestId, playbackSession)) setStatus('finished');
            },
        });
    };

    useEffect(() => {
        let active = true;
        let unlisten = null;

        const handleRequest = async (request) => {
            if (!active || !request) return;
            const requestId = request.request_id;
            if (!shouldHandleReadAloudRequest(latestRequestIdRef.current, requestId)) return;

            latestRequestIdRef.current = requestId;
            const playbackSession = ++playbackSessionRef.current;
            stopReadAloudVoice();
            audioDataRef.current = null;
            setText(normalizeReadAloudText(request.text));
            setLanguage('');
            setServiceName('');
            setError('');
            setStatus('loading');
            await appWindow.show();
            await appWindow.setFocus();

            try {
                const speech = await synthesizeWithDefaultTts(request.text, {
                    shouldContinue: () => active && latestRequestIdRef.current === requestId,
                });
                if (!active || latestRequestIdRef.current !== requestId) return;

                if (speech.failures.length)
                    toast.error(formatTtsFallbackNotice(speech.failures, speech.serviceLabel, tRef.current), {
                        style: toastStyleRef.current,
                        duration: 5000,
                    });

                audioDataRef.current = speech.data;
                setLanguage(speech.language);
                setServiceName(speech.serviceLabel);
                if (!isCurrentPlayback(requestId, playbackSession)) return;
                await playAudio(speech.data, requestId, playbackSession);
            } catch (reason) {
                if (!active || !isCurrentPlayback(requestId, playbackSession)) return;
                setError(reason instanceof Error ? reason.message : String(reason));
                setStatus('error');
                if (reason.failures?.length)
                    toast.error(formatTtsFallbackNotice(reason.failures, null, tRef.current), {
                        style: toastStyleRef.current,
                        duration: 5000,
                    });
            }
        };

        const setup = async () => {
            unlisten = await listen('read_aloud_request', (event) => {
                void handleRequest(event.payload);
            });
            const initialRequest = await invoke('get_read_aloud_request');
            await handleRequest(initialRequest);
        };
        void setup();

        return () => {
            active = false;
            playbackSessionRef.current += 1;
            unlisten?.();
            stopReadAloudVoice();
        };
    }, []);

    const replay = async () => {
        if (!audioDataRef.current) return;
        const requestId = latestRequestIdRef.current;
        const playbackSession = ++playbackSessionRef.current;
        setError('');
        try {
            const restarted = await replayReadAloudVoice({
                onStarted: () => {
                    if (isCurrentPlayback(requestId, playbackSession)) setStatus('playing');
                },
                onEnded: () => {
                    if (isCurrentPlayback(requestId, playbackSession)) setStatus('finished');
                },
            });
            if (!restarted && isCurrentPlayback(requestId, playbackSession)) setStatus('error');
        } catch (reason) {
            if (!isCurrentPlayback(requestId, playbackSession)) return;
            setError(reason instanceof Error ? reason.message : String(reason));
            setStatus('error');
        }
    };

    const pauseOrResume = async () => {
        const requestId = latestRequestIdRef.current;
        const playbackSession = playbackSessionRef.current;
        setError('');
        try {
            if (status === 'playing') {
                const paused = pauseReadAloudVoice();
                if (paused && isCurrentPlayback(requestId, playbackSession)) setStatus('paused');
            } else if (status === 'paused') {
                const resumed = await resumeReadAloudVoice();
                if (resumed && isCurrentPlayback(requestId, playbackSession)) setStatus('playing');
            }
        } catch (reason) {
            if (!isCurrentPlayback(requestId, playbackSession)) return;
            setError(reason instanceof Error ? reason.message : String(reason));
            setStatus('error');
        }
    };

    const changePlaybackRate = (value) => {
        setPlaybackRate(value);
    };

    const seek = async (seconds) => {
        const wasFinished = status === 'finished';
        if (await seekReadAloudVoice(seconds)) {
            refreshProgress();
            if (wasFinished) setStatus('playing');
        }
    };

    return (
        <TooltipProvider>
            <div className='flex h-screen w-screen flex-col bg-background text-foreground'>
                <Toaster />
                <div className='relative isolate flex h-10 shrink-0 justify-between'>
                    <WindowDragRegion />
                    <div className='pointer-events-none flex h-full flex-1 select-none items-center pl-4 text-sm font-semibold'>
                        {t('read_aloud.title')}
                    </div>
                    <WindowControl />
                </div>
                <div className='min-h-0 flex-1 px-2 pb-2'>
                    <div className='flex h-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs'>
                        <div className='min-h-0 flex-1 overflow-y-auto p-4'>
                            <textarea
                                readOnly
                                value={text}
                                className='block h-full min-h-28 w-full resize-none bg-transparent text-base outline-none'
                            />
                            {error && <p className='mt-2 text-sm text-destructive'>{error}</p>}
                        </div>
                        <div className='flex flex-col gap-1 border-t px-4 py-2'>
                            <div className='flex w-full items-center justify-between'>
                                <div className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden'>
                                    {language && (
                                        <Badge
                                            variant='secondary'
                                            className='shrink-0'
                                        >
                                            {t(`languages.${language}`)}
                                        </Badge>
                                    )}
                                    {serviceName && (
                                        <Badge
                                            variant='outline'
                                            className='min-w-0 shrink'
                                            style={{ maxWidth: READ_ALOUD_SERVICE_CHIP_MAX_WIDTH }}
                                        >
                                            <span className='truncate'>{serviceName}</span>
                                        </Badge>
                                    )}
                                    {shouldShowReadAloudStatus(status) && (
                                        <span
                                            className={cn(
                                                'truncate text-xs',
                                                status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                                            )}
                                        >
                                            {t(`read_aloud.status.${status}`)}
                                        </span>
                                    )}
                                </div>
                                <div className='ml-2 flex shrink-0 items-center gap-0.5'>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant='ghost'
                                                size='sm'
                                                className='px-1.5 tabular-nums text-muted-foreground hover:text-foreground'
                                                style={{
                                                    minWidth: READ_ALOUD_RATE_BUTTON_WIDTH,
                                                    width: READ_ALOUD_RATE_BUTTON_WIDTH,
                                                }}
                                                aria-label={t('read_aloud.playback_rate')}
                                            >
                                                {formatReadAloudPlaybackRate(playbackRate)}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            side='top'
                                            align='end'
                                            aria-label={t('read_aloud.playback_rate')}
                                        >
                                            <DropdownMenuRadioGroup
                                                value={String(playbackRate)}
                                                onValueChange={changePlaybackRate}
                                            >
                                                {READ_ALOUD_PLAYBACK_RATES.map((rate) => (
                                                    <DropdownMenuRadioItem
                                                        key={String(rate)}
                                                        value={String(rate)}
                                                    >
                                                        {formatReadAloudPlaybackRate(rate)}
                                                    </DropdownMenuRadioItem>
                                                ))}
                                            </DropdownMenuRadioGroup>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <ReadAloudVolumeControl />
                                    <ToolbarButton
                                        label={t(status === 'paused' ? 'read_aloud.resume' : 'read_aloud.pause')}
                                        disabled={status !== 'playing' && status !== 'paused'}
                                        onClick={() => void pauseOrResume()}
                                    >
                                        {status === 'paused' ? <Play /> : <Pause />}
                                    </ToolbarButton>
                                    <ToolbarButton
                                        label={t('read_aloud.replay')}
                                        disabled={!audioDataRef.current || status === 'loading'}
                                        onClick={() => void replay()}
                                    >
                                        {status === 'loading' ? <Spinner /> : <RotateCcw />}
                                    </ToolbarButton>
                                </div>
                            </div>
                            <ReadAloudProgress
                                showTime
                                className='w-full'
                                currentTime={progress.currentTime}
                                duration={progress.duration}
                                onSeek={
                                    status === 'playing' || status === 'paused' || status === 'finished'
                                        ? (seconds) => void seek(seconds)
                                        : null
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
