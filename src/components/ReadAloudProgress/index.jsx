import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { clampReadAloudTime, formatReadAloudTime, readAloudTimeFromPosition } from '../../utils/read_aloud';

export default function ReadAloudProgress({ currentTime, duration, onSeek, className = '', showTime = false }) {
    const { t } = useTranslation();
    const track = useRef(null);
    const [preview, setPreview] = useState(null);
    const [dragging, setDragging] = useState(false);
    const enabled = Number.isFinite(duration) && duration > 0 && typeof onSeek === 'function';
    const position = enabled ? clampReadAloudTime(preview ?? currentTime, duration) : 0;
    const percentage = enabled ? (position / duration) * 100 : 0;
    const timeLabel = `${formatReadAloudTime(position)} / ${formatReadAloudTime(duration)}`;
    const pointerTime = (event) => {
        const rect = track.current.getBoundingClientRect();
        return readAloudTimeFromPosition(event.clientX, rect.left, rect.width, duration);
    };
    const slider = (
        <div
            ref={track}
            role='slider'
            tabIndex={enabled ? 0 : -1}
            aria-label={t('read_aloud.progress')}
            aria-valuemin={0}
            aria-valuemax={enabled ? duration : 0}
            aria-valuenow={position}
            aria-valuetext={timeLabel}
            aria-disabled={!enabled}
            title={enabled && preview !== null ? timeLabel : undefined}
            className={cn(
                'group relative flex h-6 touch-none items-center outline-none',
                enabled ? 'cursor-pointer' : 'cursor-default',
                showTime ? 'min-w-0 flex-1' : className
            )}
            onPointerDown={(event) => {
                if (!enabled) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(true);
                setPreview(pointerTime(event));
            }}
            onPointerMove={(event) => {
                if (enabled && (dragging || event.pointerType === 'mouse')) setPreview(pointerTime(event));
            }}
            onPointerUp={(event) => {
                if (!dragging) return;
                const time = pointerTime(event);
                setDragging(false);
                setPreview(null);
                onSeek(time);
            }}
            onPointerCancel={() => {
                setDragging(false);
                setPreview(null);
            }}
            onPointerLeave={() => {
                if (!dragging) setPreview(null);
            }}
            onKeyDown={(event) => {
                if (!enabled) return;
                const amount = event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : null;
                const time =
                    event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? duration
                          : amount === null
                            ? null
                            : position + amount;
                if (time === null) return;
                event.preventDefault();
                onSeek(clampReadAloudTime(time, duration));
            }}
        >
            <div
                className={cn(
                    'w-full rounded-full bg-primary-vivid/20 transition-[height]',
                    dragging ? 'h-1' : 'h-[3px] group-hover:h-1 group-focus:h-1'
                )}
            >
                <div
                    className='h-full rounded-full bg-primary-vivid'
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {enabled && (
                <div
                    className={cn(
                        'absolute size-3 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow-xs transition-opacity',
                        dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'
                    )}
                    style={{ left: `${percentage}%` }}
                />
            )}
        </div>
    );
    if (!showTime) return slider;
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <span className='w-9 shrink-0 text-xs tabular-nums text-muted-foreground'>
                {formatReadAloudTime(position)}
            </span>
            {slider}
            <span className='w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground'>
                {formatReadAloudTime(enabled ? duration : 0)}
            </span>
        </div>
    );
}
