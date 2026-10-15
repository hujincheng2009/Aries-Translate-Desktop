import { deleteWrappedNewlines } from './newline.js';
export const DEFAULT_TRANSLATE_SERVICE_LIST = ['deepl', 'bing', 'yandex', 'google'];

export function selectDefaultEnabledService(serviceInstanceList, serviceInstanceConfigMap) {
    if (!Array.isArray(serviceInstanceList)) return null;

    return (
        serviceInstanceList.find((serviceInstanceKey) => {
            const config = serviceInstanceConfigMap?.[serviceInstanceKey] ?? {};
            return Boolean(config.enable ?? true);
        }) ?? null
    );
}

export function resolveReplacementTargetLanguage(sourceLanguage, targetLanguage, detectedLanguage, secondLanguage) {
    if (sourceLanguage === 'auto' && targetLanguage === detectedLanguage) {
        return secondLanguage;
    }
    return targetLanguage;
}

export function normalizeReplacementSourceText(text, deleteNewline) {
    if (deleteNewline) {
        return deleteWrappedNewlines(text);
    }
    return text.trim();
}
