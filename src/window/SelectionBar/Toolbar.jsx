import { Check, CircleAlert, Copy, Languages, LoaderCircle, Replace, Volume2 } from 'lucide-react';
import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

// The look of the selection assistant's floating icon and toolbar, shared by the real popup window and the
// live preview on the settings page so both always match.

const ACTION_ICONS = {
    translate: Languages,
    replace_translate: Replace,
    copy: Copy,
    read_aloud: Volume2,
};

export const FADE_MS = 120;
export const FADE_KEYFRAMES = '@keyframes selection-bar-fade { from { opacity: 0 } to { opacity: 1 } }';

function Logo() {
    return (
        <img
            alt=''
            src='/icon.svg'
            className='pointer-events-none size-[20px] shrink-0'
            draggable={false}
        />
    );
}

// Sizes are in px on purpose: the icon (32 px) and the toolbar (32 px high) must line up exactly, with the logo at
// the same spot (6 px from the top-left) in both, so expanding does not make anything jump at any app font size.
export const SelectionIcon = forwardRef(function SelectionIcon({ className, ...props }, ref) {
    return (
        <div
            ref={ref}
            data-action='expand'
            className={cn(
                'flex size-[32px] items-center justify-center rounded-[8px] border bg-card shadow-md',
                className
            )}
            {...props}
        >
            <Logo />
        </div>
    );
});

// `status` is the { action, status } of a running action; `animate` fades the buttons in when the toolbar expands.
export const SelectionToolbar = forwardRef(function SelectionToolbar(
    { actions, withLabels, showLogo, hover = null, status = null, animate = false, className, ...props },
    ref
) {
    const { t } = useTranslation();
    return (
        <div
            ref={ref}
            className={cn(
                'flex h-[32px] items-center gap-[2px] whitespace-nowrap rounded-[8px] border bg-card p-[2px] text-foreground shadow-md',
                className
            )}
            {...props}
        >
            {showLogo && (
                <>
                    <div className='flex size-[26px] items-center justify-center'>
                        <Logo />
                    </div>
                    <div className='mx-[2px] h-[16px] w-px bg-border' />
                </>
            )}
            {actions.map((action) => {
                const state = status?.action === action ? status.status : null;
                const Icon =
                    state === 'busy'
                        ? LoaderCircle
                        : state === 'copied'
                          ? Check
                          : state === 'error'
                            ? CircleAlert
                            : ACTION_ICONS[action];
                const label = state === 'copied' ? t('selection_bar.copied') : t(`selection_bar.${action}`);
                return (
                    <div
                        key={action}
                        data-action={action}
                        aria-label={label}
                        style={animate ? { animation: `selection-bar-fade ${FADE_MS}ms ease-out` } : undefined}
                        className={cn(
                            'flex h-[26px] items-center gap-[6px] rounded-[6px] text-[13px] leading-none',
                            withLabels ? 'pl-[7px] pr-[9px]' : 'w-[26px] justify-center',
                            (hover === action || state) && 'bg-accent',
                            state === 'error' && 'text-destructive'
                        )}
                    >
                        <Icon
                            className={cn(
                                'size-[16px] shrink-0',
                                state === 'busy' && 'animate-spin text-primary',
                                state === 'copied' && 'text-primary'
                            )}
                        />
                        {withLabels && <span>{label}</span>}
                    </div>
                );
            })}
        </div>
    );
});
