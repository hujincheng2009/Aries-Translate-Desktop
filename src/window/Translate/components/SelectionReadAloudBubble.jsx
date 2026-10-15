import { LoaderCircle, Square, Volume2 } from 'lucide-react';
import { useAtomValue } from 'jotai';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useConfig, useToastStyle } from '../../../hooks';
import { pauseTranslationReadAloudVoice } from '../../../hooks/useTranslationReadAloud';
import { stopVoice } from '../../../hooks/useVoice';
import { READ_ALOUD_VOLUME_CONFIG_KEY } from '../../../utils/read_aloud';
import {
    SELECTION_READ_ALOUD_CONFIG_KEY,
    selectionBubblePosition,
    selectionSpeechText,
} from '../../../utils/selection_read_aloud';
import {
    clearSelectionReadAloudCache,
    speakSelection,
    stopSelectionReadAloud,
} from '../../../utils/selection_read_aloud_player';
import { formatTtsFallbackNotice } from '../../../utils/tts_fallback';
import { sourceTextAtom } from './SourceArea';

// Read-aloud bubble (划词朗读): select text inside a result card and a small button appears next to the selection;
// clicking it reads only that text. One bubble per translate window. Design: Figma "S · 翻译窗口划词朗读（1.1.3）".

const CONTAINER = '[data-selection-read-aloud]';

// The selected text and the rectangle where it ends, or null when nothing in a result card is selected.
function readSelection(event) {
    const target = event.target instanceof Element ? event.target : null;
    const container = target?.closest(CONTAINER);
    if (!container) return null;
    const language = container.getAttribute('data-selection-read-aloud');
    // Plain text results are a <textarea>, whose selection is not part of window.getSelection().
    if (target.tagName === 'TEXTAREA') {
        const { value, selectionStart, selectionEnd } = target;
        const text = value.slice(selectionStart, selectionEnd);
        const rect = { top: event.clientY - 11, right: event.clientX, bottom: event.clientY + 11 };
        return { text, language, rect };
    }
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    if (!container.contains(selection.anchorNode) || !container.contains(selection.focusNode)) return null;
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    return { text: selection.toString(), language, rect };
}

export default function SelectionReadAloudBubble({ serviceInstanceConfigMap }) {
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [enabled] = useConfig(SELECTION_READ_ALOUD_CONFIG_KEY, true);
    const [volume] = useConfig(READ_ALOUD_VOLUME_CONFIG_KEY, 100);
    const [ttsServiceList] = useConfig('tts_service_list', ['lingva_tts']);
    const sourceText = useAtomValue(sourceTextAtom);
    const [bubble, setBubble] = useState(null);
    const [status, setStatus] = useState('idle');
    const bubbleRef = useRef(null);

    const hide = () => {
        stopSelectionReadAloud();
        setBubble(null);
        setStatus('idle');
    };

    useEffect(() => {
        if (!enabled) {
            hide();
            return;
        }
        const insideBubble = (event) => event.target instanceof Node && bubbleRef.current?.contains(event.target);
        const onMouseDown = (event) => {
            if (!insideBubble(event)) hide();
        };
        const onMouseUp = (event) => {
            if (event.button !== 0 || insideBubble(event)) return;
            // Let the browser finish updating the selection first.
            setTimeout(() => {
                const selection = readSelection(event);
                const text = selectionSpeechText(selection?.text);
                if (!text) return;
                const position = selectionBubblePosition(selection.rect, {
                    width: window.innerWidth,
                    height: window.innerHeight,
                });
                setStatus('idle');
                setBubble({ text, language: selection.language, ...position });
            }, 0);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') hide();
        };
        const onHidden = () => {
            if (document.hidden) {
                hide();
                clearSelectionReadAloudCache();
            }
        };
        document.addEventListener('mousedown', onMouseDown, true);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('visibilitychange', onHidden);
        window.addEventListener('scroll', hide, true);
        window.addEventListener('blur', hide);
        return () => {
            document.removeEventListener('mousedown', onMouseDown, true);
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('visibilitychange', onHidden);
            window.removeEventListener('scroll', hide, true);
            window.removeEventListener('blur', hide);
        };
    }, [enabled]);

    // A new translation replaces the results the selection was in.
    useEffect(() => hide(), [sourceText]);
    useEffect(() => () => clearSelectionReadAloudCache(), []);

    if (!enabled || !bubble) return null;

    const speak = async () => {
        if (status !== 'idle') {
            stopSelectionReadAloud();
            setStatus('idle');
            return;
        }
        stopVoice();
        pauseTranslationReadAloudVoice();
        setStatus('loading');
        try {
            const speech = await speakSelection(bubble.text, {
                fallbackLanguage: bubble.language,
                serviceInstanceList: ttsServiceList,
                getConfig: (instanceKey) => serviceInstanceConfigMap?.[instanceKey] ?? {},
                volume: Number(volume ?? 100),
                onStarted: () => setStatus('playing'),
                onEnded: () => setStatus('idle'),
            });
            if (speech?.failures?.length) {
                toast.error(formatTtsFallbackNotice(speech.failures, speech.serviceLabel, t), {
                    style: toastStyle,
                    duration: 5000,
                });
            }
        } catch (e) {
            setStatus('idle');
            toast.error(e.failures ? formatTtsFallbackNotice(e.failures, null, t) : e.message ?? String(e), {
                style: toastStyle,
            });
        }
    };

    const Icon = status === 'loading' ? LoaderCircle : status === 'playing' ? Square : Volume2;
    const label = t(status === 'idle' ? 'translate.selection_read_aloud' : 'translate.selection_read_aloud_stop');

    return (
        <button
            ref={bubbleRef}
            type='button'
            aria-label={label}
            title={label}
            // Keep the text selected while clicking.
            onMouseDown={(event) => event.preventDefault()}
            onClick={speak}
            className='group fixed z-50 flex size-[32px] items-center justify-center rounded-[8px] border bg-card p-[2px] text-foreground shadow-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
            style={{ left: bubble.left, top: bubble.top }}
        >
            <span className='flex size-full items-center justify-center rounded-[6px] group-hover:bg-accent'>
                <Icon className={cn('size-[16px]', status === 'loading' && 'animate-spin text-muted-foreground')} />
            </span>
        </button>
    );
}
