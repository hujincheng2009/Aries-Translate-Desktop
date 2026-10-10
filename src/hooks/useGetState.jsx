import { useState, useRef, useCallback } from 'react';

export const useGetState = (initState) => {
    const [state, setState] = useState(initState);
    const stateRef = useRef(state);
    stateRef.current = state;
    const getState = useCallback(() => stateRef.current, []);
    const setCurrentState = useCallback((value) => {
        const next = typeof value === 'function' ? value(stateRef.current) : value;
        stateRef.current = next;
        setState(next);
    }, []);
    return [state, setCurrentState, getState];
};
