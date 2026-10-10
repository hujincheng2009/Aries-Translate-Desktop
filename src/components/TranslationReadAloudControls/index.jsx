import React from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import ReadAloudVolumeControl from '../app/ReadAloudVolumeControl';
import ToolbarButton from '../app/ToolbarButton';
import ReadAloudProgress from '../ReadAloudProgress';
import { useReadAloudProgress } from '../../hooks/useReadAloudProgress';
import { formatReadAloudPlaybackRate, READ_ALOUD_PLAYBACK_RATES } from '../../utils/read_aloud';

export default function TranslationReadAloudControls({ voice, playbackRate, setPlaybackRate }) {
    const { t } = useTranslation();
    const [progress, refresh] = useReadAloudProgress(voice.status);
    const seek = async (seconds) => {
        await voice.seek(seconds);
        refresh();
    };
    return (
        <div
            className={cn(
                'grid transition-[grid-template-rows,opacity] duration-150',
                voice.mine ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            )}
        >
            <div className='overflow-hidden'>
                <div className='px-2 pb-2'>
                    <div className='flex items-center gap-0.5'>
                        <ToolbarButton
                            label={t(voice.status === 'paused' ? 'read_aloud.resume' : 'read_aloud.pause')}
                            disabled={voice.status !== 'playing' && voice.status !== 'paused'}
                            onClick={() => void voice.pauseOrResume()}
                        >
                            {voice.status === 'paused' ? <Play /> : <Pause />}
                        </ToolbarButton>
                        <ToolbarButton
                            label={t('read_aloud.replay')}
                            disabled={voice.status === 'loading'}
                            onClick={() => void voice.replay()}
                        >
                            <RotateCcw />
                        </ToolbarButton>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='min-w-12 px-1.5 tabular-nums text-muted-foreground hover:text-foreground'
                                    aria-label={t('read_aloud.playback_rate')}
                                >
                                    {formatReadAloudPlaybackRate(playbackRate)}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side='top'
                                align='start'
                                aria-label={t('read_aloud.playback_rate')}
                            >
                                <DropdownMenuRadioGroup
                                    value={String(playbackRate)}
                                    onValueChange={setPlaybackRate}
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
                    </div>
                    <ReadAloudProgress
                        showTime
                        className='mx-1'
                        currentTime={progress.currentTime}
                        duration={progress.duration}
                        onSeek={
                            voice.status === 'playing' || voice.status === 'paused' || voice.status === 'finished'
                                ? (seconds) => void seek(seconds)
                                : null
                        }
                    />
                </div>
            </div>
        </div>
    );
}
