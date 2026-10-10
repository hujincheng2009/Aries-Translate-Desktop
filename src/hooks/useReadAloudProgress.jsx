import { useCallback, useEffect, useState } from 'react';
import { getReadAloudProgress } from '../utils/read_aloud_player';

export function useReadAloudProgress(status) {
    const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
    const refreshProgress = useCallback(() => setProgress(getReadAloudProgress()), []);
    useEffect(() => {
        if (status === 'idle' || status === 'loading' || status === 'error') {
            setProgress({ currentTime: 0, duration: 0 });
            return;
        }
        let frame;
        const refresh = () => {
            refreshProgress();
            if (status === 'playing' && !document.hidden) frame = requestAnimationFrame(refresh);
        };
        refresh();
        const onVisibility = () => {
            cancelAnimationFrame(frame);
            if (!document.hidden) refresh();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [status, refreshProgress]);
    return [progress, refreshProgress];
}
