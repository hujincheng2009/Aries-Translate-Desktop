import { normalizeReadAloudText } from './read_aloud.js';

// "Delete line breaks" for source and OCR text (1.1.4). Only line breaks that wrap a sentence are removed: a line
// that ends a sentence (。！？.!?…；; and colons), a list item, a heading or a blank line keeps its break, so a
// multi-paragraph selection is not translated as one long block. A word broken with a hyphen at a line end is joined
// and keeps the hyphen; Chinese and Japanese lines are joined without a space. Same rules as the read-aloud text clean-up.
export function deleteWrappedNewlines(text) {
    return normalizeReadAloudText(text);
}

// The old behaviour: every line break and run of spaces becomes one space.
export function deleteAllNewlines(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/(\p{L})-[ \t]*\r?\n\s*(\p{L})/gu, '$1-$2')
        .replace(/\s+/g, ' ')
        .trim();
}

// The toolbar button: the first click removes wrapped line breaks; when nothing is left to remove that way, the next
// click joins everything into one line.
export function deleteNewlinesOnClick(text) {
    const wrapped = deleteWrappedNewlines(text);
    return wrapped === (typeof text === 'string' ? text.trim() : '') ? deleteAllNewlines(text) : wrapped;
}
