import { useEffect } from 'react';
import { useConfig } from './useConfig';
import { READ_ALOUD_VOLUME_CONFIG_KEY, normalizeReadAloudVolume } from '../utils/read_aloud';
import { setReadAloudVolume } from '../utils/read_aloud_player';
import { setVoiceVolume } from './useVoice';

export function useReadAloudVolume() {
    const [storedVolume, setStoredVolume] = useConfig(READ_ALOUD_VOLUME_CONFIG_KEY, 100);
    const volume = normalizeReadAloudVolume(storedVolume);
    useEffect(() => {
        if (storedVolume === null) return;
        setReadAloudVolume(volume);
        setVoiceVolume(volume);
    }, [volume, storedVolume]);
    return [
        volume,
        (value) => {
            const next = normalizeReadAloudVolume(value);
            setReadAloudVolume(next);
            setVoiceVolume(next);
            setStoredVolume(next);
        },
    ];
}
