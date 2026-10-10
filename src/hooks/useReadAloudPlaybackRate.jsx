import { useEffect } from 'react';
import { useConfig } from './useConfig';
import {
    normalizeReadAloudPlaybackRate,
    READ_ALOUD_PLAYBACK_RATE_CONFIG_KEY,
    READ_ALOUD_PLAYBACK_RATE_STORAGE_KEY,
    resolveInitialReadAloudPlaybackRate,
} from '../utils/read_aloud';
import { setReadAloudPlaybackRate } from '../utils/read_aloud_player';

export function useReadAloudPlaybackRate() {
    const [storedRate, setStoredRate] = useConfig(
        READ_ALOUD_PLAYBACK_RATE_CONFIG_KEY,
        resolveInitialReadAloudPlaybackRate(null, localStorage.getItem(READ_ALOUD_PLAYBACK_RATE_STORAGE_KEY))
    );
    const rate = normalizeReadAloudPlaybackRate(storedRate);
    useEffect(() => {
        setReadAloudPlaybackRate(rate);
    }, [rate]);
    return [rate, (value) => setStoredRate(normalizeReadAloudPlaybackRate(value))];
}
