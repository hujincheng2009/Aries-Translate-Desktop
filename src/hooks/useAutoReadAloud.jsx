import { atom, getDefaultStore } from 'jotai';
import {
    INITIAL_AUTO_READ_STATE,
    beginAutoReadRound,
    reportAutoReadCard,
    claimAutoReadCard,
} from '../utils/auto_read_aloud';

export const autoReadAloudAtom = atom(INITIAL_AUTO_READ_STATE);

export function syncAutoReadRound(context, cards, enabled) {
    const store = getDefaultStore();
    store.set(autoReadAloudAtom, (state) => beginAutoReadRound(state, context, cards, enabled));
}

export function getAutoReadRound(context) {
    const state = getDefaultStore().get(autoReadAloudAtom);
    return state.context === context ? state.round : null;
}

export function reportAutoReadResult(context, round, id, status, text) {
    getDefaultStore().set(autoReadAloudAtom, (state) => reportAutoReadCard(state, context, round, id, status, text));
}

export function claimAutoRead(context, id) {
    const store = getDefaultStore();
    const old = store.get(autoReadAloudAtom);
    const next = claimAutoReadCard(old, context, id);
    if (next === old) return false;
    store.set(autoReadAloudAtom, next);
    return true;
}

export function cancelAutoReadAloud() {
    getDefaultStore().set(autoReadAloudAtom, (state) => ({ ...state, cancelled: true }));
}
