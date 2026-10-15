// Pure helpers for the read-aloud bubble in the translate window (划词朗读, 1.1.3): select text in a result card,
// click the bubble, hear only that part. Its audio cache is separate from the card read-aloud player.

export const SELECTION_READ_ALOUD_CONFIG_KEY = 'translate_selection_read_aloud';
export const SELECTION_READ_ALOUD_MAX_CHARS = 200;
export const SELECTION_READ_ALOUD_CACHE_SIZE = 20;
export const SELECTION_BUBBLE_SIZE = 32;
const BUBBLE_GAP = 4;
const EDGE = 8;

// The text to read, or '' when the bubble should not appear (blank, or longer than the limit).
export function selectionSpeechText(text) {
    if (typeof text !== 'string') return '';
    const trimmed = text.trim();
    if (!trimmed || [...trimmed].length > SELECTION_READ_ALOUD_MAX_CHARS) return '';
    return trimmed;
}

// Bubble position (viewport px): 4 px right of and below the end of the selection, kept inside the window.
export function selectionBubblePosition(rect, viewport) {
    const size = SELECTION_BUBBLE_SIZE;
    let left = rect.right + BUBBLE_GAP;
    let top = rect.bottom + BUBBLE_GAP;
    if (left + size > viewport.width - EDGE) left = viewport.width - EDGE - size;
    if (top + size > viewport.height - EDGE) top = rect.top - BUBBLE_GAP - size;
    return { left: Math.max(EDGE, Math.round(left)), top: Math.max(EDGE, Math.round(top)) };
}

export function selectionCacheKey(text, fallbackLanguage, serviceInstanceList) {
    return JSON.stringify([text, fallbackLanguage ?? '', serviceInstanceList ?? []]);
}

// Most-recently-used audio cache; re-reading the same words does not synthesize again.
export function createSelectionAudioCache(limit = SELECTION_READ_ALOUD_CACHE_SIZE) {
    const entries = new Map();
    return {
        get(key) {
            if (!entries.has(key)) return undefined;
            const value = entries.get(key);
            entries.delete(key);
            entries.set(key, value);
            return value;
        },
        set(key, value) {
            entries.delete(key);
            entries.set(key, value);
            while (entries.size > limit) entries.delete(entries.keys().next().value);
        },
        clear() {
            entries.clear();
        },
        get size() {
            return entries.size;
        },
    };
}
