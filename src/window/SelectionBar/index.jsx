import { Check, CircleAlert, Copy, Languages, LoaderCircle, Replace, Volume2 } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/tauri';

import { cn } from '@/lib/utils';
import { normalizeActions } from '../../utils/selection_assistant';

// Floating icon / toolbar of the selection assistant (划词助手). The window never takes focus: Rust swallows
// clicks on it and sends `selection_bar_click` / `selection_bar_pointer` with page coordinates instead, so the
// program the user selected text in keeps its selection. Design: Figma "S · 划词助手（1.1.0）".

const ACTION_ICONS = {
    translate: Languages,
    replace_translate: Replace,
    copy: Copy,
    read_aloud: Volume2,
};

const ERROR_KEYS = {
    no_text: 'selection_bar.error_no_text',
    window_changed: 'selection_bar.error_window_changed',
};

function actionAt(x, y) {
    const element = document.elementFromPoint(x, y);
    return element?.closest('[data-action]')?.dataset.action ?? null;
}

// Sizes are in px on purpose: the icon (32 px) and the toolbar (32 px high) must line up exactly, with the logo at
// the same spot (6 px from the top-left) in both, so expanding does not make anything jump at any app font size.
const FADE_MS = 120;
const FADE_KEYFRAMES = '@keyframes selection-bar-fade { from { opacity: 0 } to { opacity: 1 } }';

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

export default function SelectionBar() {
    const { t } = useTranslation();
    const [session, setSession] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [hover, setHover] = useState(null);
    const [status, setStatus] = useState(null);
    // Fade: false while the window is being placed and while it fades out before leaving the screen.
    const [visible, setVisible] = useState(false);
    const rootRef = useRef(null);
    const contentRef = useRef(null);
    const live = useRef({ session: null, expanded: false });
    live.current = { session, expanded };

    useEffect(() => {
        document.body.style.background = 'transparent';
        document.body.style.overflow = 'hidden';
    }, []);

    const runAction = useCallback((seq, action) => {
        invoke('selection_bar_action', { seq, action });
    }, []);

    useEffect(() => {
        const current = (seq) => live.current.session?.seq === seq;
        const unlisten = [
            listen('selection_bar_show', ({ payload }) => {
                setVisible(false);
                setSession(payload);
                setExpanded(payload.settings.displayMode === 'toolbar');
                setHover(null);
                setStatus(null);
            }),
            listen('selection_bar_hidden', ({ payload }) => {
                if (!current(payload)) return;
                setVisible(false);
                setTimeout(() => {
                    if (current(payload)) setSession(null);
                }, FADE_MS + 20);
            }),
            listen('selection_bar_pointer', ({ payload }) => {
                if (!current(payload.seq)) return;
                setHover(payload.inside ? actionAt(payload.x, payload.y) : null);
                if (payload.inside && !live.current.expanded) setExpanded(true);
            }),
            listen('selection_bar_click', ({ payload }) => {
                if (!current(payload.seq)) return;
                if (!live.current.expanded) {
                    setExpanded(true);
                    return;
                }
                const action = actionAt(payload.x, payload.y);
                if (action) runAction(payload.seq, action);
            }),
            listen('selection_bar_state', ({ payload }) => {
                if (current(payload.seq)) setStatus(payload);
            }),
        ];
        return () => unlisten.forEach((promise) => promise.then((off) => off()));
    }, [runAction]);

    const settings = session?.settings;
    const actions = normalizeActions(settings?.actions);
    const withLabels = settings?.buttonStyle !== 'icon';
    const showLogo = settings?.showLogo !== false;
    const tooltipAction = !withLabels && status?.status !== 'error' && actions.includes(hover) ? hover : null;
    const errorMessage =
        status?.status === 'error' ? t(ERROR_KEYS[status.message] ?? 'selection_bar.error_generic') : null;

    // Report the size of what is drawn so Rust can place the window; the content box is the clickable area.
    useLayoutEffect(() => {
        if (!session || !rootRef.current || !contentRef.current) return;
        const root = rootRef.current.getBoundingClientRect();
        const content = contentRef.current.getBoundingClientRect();
        const seq = session.seq;
        invoke('selection_bar_set_size', {
            seq: session.seq,
            width: Math.ceil(root.width),
            height: Math.ceil(root.height),
            hitX: content.left - root.left,
            hitY: content.top - root.top,
            hitWidth: Math.ceil(content.width),
            hitHeight: Math.ceil(content.height),
            expanded,
        }).then(() =>
            // A timer, not requestAnimationFrame: frames are throttled while the window still waits off screen.
            setTimeout(() => {
                if (live.current.session?.seq === seq) setVisible(true);
            }, 16)
        );
    }, [session, expanded, tooltipAction, errorMessage, status, withLabels, showLogo]);

    if (!session) return null;

    return (
        <div
            ref={rootRef}
            className='inline-flex cursor-default select-none flex-col items-start gap-1 p-1.5 text-foreground transition-opacity ease-out'
            style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        >
            <style>{FADE_KEYFRAMES}</style>
            {expanded ? (
                <div
                    ref={contentRef}
                    className='flex h-[32px] items-center gap-[2px] whitespace-nowrap rounded-[8px] border bg-card p-[2px] shadow-md'
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
                                style={{ animation: `selection-bar-fade ${FADE_MS}ms ease-out` }}
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
            ) : (
                <div
                    ref={contentRef}
                    data-action='expand'
                    className='flex size-[32px] items-center justify-center rounded-[8px] border bg-card shadow-md'
                >
                    <Logo />
                </div>
            )}
            {(tooltipAction || errorMessage) && (
                <div
                    className={cn(
                        'whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs shadow-md',
                        errorMessage && 'text-destructive'
                    )}
                >
                    {errorMessage ?? t(`selection_bar.${tooltipAction}`)}
                </div>
            )}
        </div>
    );
}
