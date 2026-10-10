import { useEffect, useRef } from 'react';
import { atom, getDefaultStore, useAtom } from 'jotai';
import {
    pauseReadAloudVoice,
    playReadAloudVoice,
    replayReadAloudVoice,
    resumeReadAloudVoice,
    seekReadAloudVoice,
    stopReadAloudVoice,
} from '../utils/read_aloud_player';
import { cancelAutoReadAloud } from './useAutoReadAloud';
import { stopVoice } from './useVoice';

export const translationReadAloudAtom = atom({ cardId: null, status: 'idle' });
let generation = 0;

export function stopTranslationReadAloudVoice() {
    cancelAutoReadAloud();
    stopVoice();
    generation += 1;
    stopReadAloudVoice();
    getDefaultStore().set(translationReadAloudAtom, { cardId: null, status: 'idle' });
}

export function useTranslationReadAloud(cardId, text) {
    const [active, setActive] = useAtom(translationReadAloudAtom);
    const mine = active.cardId === cardId;
    const mineRef = useRef(mine);
    mineRef.current = mine;
    const status = mine ? active.status : 'idle';
    const stop = () => {
        cancelAutoReadAloud();
        generation += 1;
        stopReadAloudVoice();
        setActive({ cardId: null, status: 'idle' });
    };
    const start = async (synthesize, rate, onSynthesis, { automatic = false } = {}) => {
        if (!automatic) cancelAutoReadAloud();
        if (mine) {
            stop();
            return;
        }
        const session = ++generation;
        stopVoice();
        stopReadAloudVoice();
        setActive({ cardId, status: 'loading' });
        const isCurrent = () => generation === session;
        try {
            const result = await synthesize(isCurrent);
            if (!isCurrent()) return;
            const data = result?.data ?? result;
            if (data == null || (typeof data.length === 'number' && data.length === 0))
                throw new Error('TTS service returned no audio');
            onSynthesis?.(result);
            await playReadAloudVoice(data, {
                playbackRate: rate,
                onStarted: () => {
                    if (isCurrent()) setActive({ cardId, status: 'playing' });
                },
                onEnded: () => {
                    if (isCurrent()) setActive({ cardId, status: 'finished' });
                },
            });
        } catch (error) {
            if (!isCurrent()) return;
            stop();
            throw error;
        }
    };
    const pauseOrResume = async () => {
        cancelAutoReadAloud();
        if (!mine) return;
        const session = generation;
        if (status === 'playing' && pauseReadAloudVoice()) setActive({ cardId, status: 'paused' });
        else if (status === 'paused' && (await resumeReadAloudVoice()) && generation === session) {
            setActive({ cardId, status: 'playing' });
        }
    };
    const replay = async () => {
        cancelAutoReadAloud();
        if (!mine || status === 'loading') return;
        const session = generation;
        await replayReadAloudVoice({
            onStarted: () => {
                if (generation === session) setActive({ cardId, status: 'playing' });
            },
            onEnded: () => {
                if (generation === session) setActive({ cardId, status: 'finished' });
            },
        });
    };
    const seek = async (seconds) => {
        if (!mine) return;
        const finished = status === 'finished';
        const session = generation;
        if ((await seekReadAloudVoice(seconds)) && finished && generation === session) {
            setActive({ cardId, status: 'playing' });
        }
    };
    useEffect(() => {
        if (mine) stop();
    }, [text]);
    useEffect(
        () => () => {
            if (mineRef.current) stop();
        },
        []
    );
    return { mine, status, start, stop, pauseOrResume, replay, seek };
}

export function useTranslationReadAloudWindowCleanup() {
    useEffect(() => {
        const stop = stopTranslationReadAloudVoice;
        const hidden = () => {
            if (document.hidden) stop();
        };
        window.addEventListener('beforeunload', stop);
        document.addEventListener('visibilitychange', hidden);
        return () => {
            window.removeEventListener('beforeunload', stop);
            document.removeEventListener('visibilitychange', hidden);
            stop();
        };
    }, []);
}
