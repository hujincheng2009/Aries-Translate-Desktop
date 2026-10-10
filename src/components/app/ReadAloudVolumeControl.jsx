import React, { useEffect, useRef } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import ToolbarButton from './ToolbarButton';
import { useReadAloudVolume } from '../../hooks/useReadAloudVolume';

export default function ReadAloudVolumeControl() {
    const { t } = useTranslation();
    const [volume, setVolume] = useReadAloudVolume();
    const lastAudible = useRef(100);
    const button = useRef(null);
    const current = useRef({ volume, setVolume });
    current.current = { volume, setVolume };
    if (volume > 0) lastAudible.current = volume;
    useEffect(() => {
        const element = button.current;
        const wheel = (event) => {
            if (!event.deltaY) return;
            event.preventDefault();
            const next = Math.max(0, Math.min(100, current.current.volume + (event.deltaY < 0 ? 5 : -5)));
            current.current.volume = next;
            current.current.setVolume(next);
        };
        element?.addEventListener('wheel', wheel, { passive: false });
        return () => element?.removeEventListener('wheel', wheel);
    }, []);
    const Icon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
    return (
        <Popover>
            <PopoverTrigger asChild>
                <ToolbarButton
                    ref={button}
                    label={`${t('read_aloud.volume')} · ${volume}%`}
                >
                    <Icon />
                </ToolbarButton>
            </PopoverTrigger>
            <PopoverContent
                side='top'
                className='w-60 space-y-3'
            >
                <div className='flex items-center justify-between gap-3 text-sm'>
                    <span>{t('read_aloud.volume')}</span>
                    <span className='tabular-nums'>{volume}%</span>
                </div>
                <Slider
                    aria-label={t('read_aloud.volume')}
                    min={0}
                    max={100}
                    step={5}
                    value={[volume]}
                    onValueChange={([next]) => setVolume(next)}
                />
                <Button
                    className='w-full'
                    variant='outline'
                    size='sm'
                    onClick={() => setVolume(volume === 0 ? lastAudible.current : 0)}
                >
                    {volume === 0 ? <Volume2 /> : <VolumeX />}
                    {t(volume === 0 ? 'read_aloud.unmute' : 'read_aloud.mute')}
                </Button>
            </PopoverContent>
        </Popover>
    );
}
