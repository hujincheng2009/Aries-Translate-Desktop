export const AUTO_READ_WAIT = Symbol('waiting for earlier cards');

export function pickAutoReadCard(cards) {
    for (const card of cards) {
        if (card.status === 'pending') return AUTO_READ_WAIT;
        if (card.status === 'success' && typeof card.text === 'string' && card.text.trim()) return card.id;
    }
    return null;
}

export const INITIAL_AUTO_READ_STATE = {
    round: 0,
    context: null,
    enabled: false,
    cancelled: true,
    claimed: false,
    cards: [],
};

export function beginAutoReadRound(state, context, cards, enabled) {
    if (state.context === context) {
        return {
            ...state,
            enabled,
            cancelled: state.cancelled || !enabled,
            cards: cards.map((card) => state.cards.find((old) => old.id === card.id) ?? { ...card, text: '' }),
        };
    }
    return {
        round: state.round + 1,
        context,
        enabled,
        cancelled: !enabled,
        claimed: false,
        cards: cards.map((card) => ({ ...card, text: '' })),
    };
}

export function reportAutoReadCard(state, context, round, id, status, text = '') {
    if (state.context !== context || state.round !== round || state.cancelled || state.claimed) return state;
    return { ...state, cards: state.cards.map((card) => (card.id === id ? { ...card, status, text } : card)) };
}

export function claimAutoReadCard(state, context, id) {
    if (
        state.context !== context ||
        !state.enabled ||
        state.cancelled ||
        state.claimed ||
        pickAutoReadCard(state.cards) !== id
    )
        return state;
    return { ...state, claimed: true };
}
