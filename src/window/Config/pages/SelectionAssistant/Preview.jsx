import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { SelectionIcon, SelectionToolbar } from '../../../SelectionBar/Toolbar';

// Live preview at the top of the selection assistant page: a sample sentence with a selection, and the icon or
// toolbar drawn at the configured offset from where the mouse was released, at 1:1 scale.
// Design: Figma "S · 划词助手（1.1.0）" → "设置 · 划词助手 · 1.1.1".

const BAR_HEIGHT = 32;
const HINT_HEIGHT = 24;
const PAD = 24;

function Chip({ children }) {
    return (
        <span className='whitespace-nowrap rounded-md border bg-card px-2 py-0.5 text-xs leading-4 text-muted-foreground'>
            {children}
        </span>
    );
}

export default function SelectionPreview({
    enabled,
    displayMode,
    buttonStyle,
    showLogo,
    offsetX,
    offsetY,
    hideDelay,
    actions,
}) {
    const { t } = useTranslation();
    const lineRef = useRef(null);
    const selectionRef = useRef(null);
    // Where the mouse was released: the end of the selection, at the bottom of its line (relative to the line).
    const [anchor, setAnchor] = useState({ x: 0, y: 0 });

    useLayoutEffect(() => {
        const line = lineRef.current;
        const selection = selectionRef.current;
        if (!line || !selection) return;
        const measure = () => {
            const box = line.getBoundingClientRect();
            const end = selection.getBoundingClientRect();
            setAnchor({ x: end.right - box.left, y: end.bottom - box.top });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(line);
        return () => observer.disconnect();
    }, []);

    const iconMode = displayMode === 'icon';
    const toolbar = (
        <SelectionToolbar
            actions={actions}
            withLabels={buttonStyle !== 'icon'}
            showLogo={showLogo}
        />
    );

    // Room for the popup: push the sentence down when it opens above it, and grow the box when it opens below.
    // The hover hint's room is kept in both display modes so switching them does not change the height.
    // The hint sits above the toolbar when it opens upwards, so it does not cover the sample sentence.
    const hintAbove = offsetY < 0;
    const barTop = anchor.y + offsetY;
    const popupTop = barTop - (hintAbove ? HINT_HEIGHT : 0);
    const popupBottom = barTop + BAR_HEIGHT + (hintAbove ? 0 : HINT_HEIGHT);
    const top = Math.max(PAD, 16 - popupTop);
    const height = Math.max(160, top + Math.max(popupBottom, anchor.y) + 48);
    const ax = PAD + anchor.x;
    const ay = top + anchor.y;
    const bx = ax + offsetX;
    const by = ay + offsetY;

    return (
        <div className='flex flex-col gap-2 rounded-xl border bg-muted p-2 pt-1.5'>
            <div className='flex items-center gap-2 px-2'>
                <span className='text-xs font-medium leading-6'>{t('config.selection.preview')}</span>
                <span className='min-w-0 flex-1 truncate text-xs text-muted-foreground'>
                    {t('config.selection.preview_desc')}
                </span>
                <Chip>{`X ${offsetX} · Y ${offsetY} px`}</Chip>
                <Chip>
                    {hideDelay === 0
                        ? t('config.selection.preview_never')
                        : t('config.selection.preview_hide_after', { count: hideDelay })}
                </Chip>
            </div>
            <div
                aria-hidden='true'
                className='relative select-none overflow-hidden rounded-lg border bg-card text-sm'
                style={{ height }}
            >
                <div className={cn('absolute inset-0', !enabled && 'opacity-[0.45]')}>
                    <div
                        ref={lineRef}
                        className='absolute whitespace-nowrap leading-[22px]'
                        style={{ left: PAD, top }}
                    >
                        {t('config.selection.preview_sample_before')}
                        <span
                            ref={selectionRef}
                            className='bg-[#c7defe] dark:bg-[#264f78]'
                        >
                            {t('config.selection.preview_sample_selected')}
                        </span>
                        {t('config.selection.preview_sample_after')}
                    </div>
                    <div
                        className='absolute bottom-4 whitespace-nowrap leading-[22px] text-muted-foreground'
                        style={{ left: PAD }}
                    >
                        {t('config.selection.preview_sample_hint')}
                    </div>
                    {/* I-beam cursor where the drag ended */}
                    <svg
                        className='absolute text-foreground'
                        style={{ left: ax - 4, top: ay - 22 }}
                        width='8'
                        height='22'
                        viewBox='0 0 8 22'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='1.5'
                    >
                        <path d='M0.5 1H7.5M4 1V21M0.5 21H7.5' />
                    </svg>
                </div>
                {enabled ? (
                    <>
                        {/* Offset guide: from the release point across by X, then down by Y */}
                        <svg className='pointer-events-none absolute inset-0 size-full overflow-visible text-foreground/[0.45]'>
                            <path
                                d={`M${ax} ${ay}H${bx}V${by}`}
                                fill='none'
                                stroke='currentColor'
                                strokeDasharray='3 3'
                            />
                            <circle
                                cx={ax}
                                cy={ay}
                                r='3'
                                className='fill-foreground'
                            />
                        </svg>
                        <div
                            className='absolute flex items-start'
                            style={{ left: bx, top: by }}
                        >
                            {iconMode ? (
                                <>
                                    <SelectionIcon />
                                    <svg
                                        className='mx-2 mt-[10px] shrink-0 text-muted-foreground'
                                        width='24'
                                        height='12'
                                        viewBox='0 0 24 12'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='1.25'
                                    >
                                        <path d='M1 6H22M17 1L22 6L17 11' />
                                    </svg>
                                    <div className='relative'>
                                        <div className='opacity-[0.55]'>{toolbar}</div>
                                        <span
                                            className={cn(
                                                'absolute left-0 whitespace-nowrap text-xs leading-4 text-muted-foreground',
                                                hintAbove ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                            )}
                                        >
                                            {t('config.selection.preview_hover_hint')}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                toolbar
                            )}
                        </div>
                    </>
                ) : (
                    <div className='absolute inset-x-0 bottom-12 flex justify-center'>
                        <Chip>{t('config.selection.preview_disabled')}</Chip>
                    </div>
                )}
            </div>
        </div>
    );
}
