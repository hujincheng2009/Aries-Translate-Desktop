// A hint belongs only to the exact OCR output, never to subsequently edited text.
export function resolveOcrSourceLanguage(sourceLanguage, text, hint, enabled) {
    if (
        sourceLanguage !== 'auto' ||
        !enabled ||
        !hint ||
        hint.text !== text ||
        !hint.language ||
        hint.language === 'auto'
    ) {
        return sourceLanguage;
    }
    return hint.language;
}
