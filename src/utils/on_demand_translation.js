export const ON_DEMAND_TRANSLATE_SERVICE_LIST_KEY = 'translate_on_demand_service_list';

export function createTranslationFingerprint(sourceText, sourceLanguage, targetLanguage, serviceInstanceKey) {
    return JSON.stringify([sourceText.trim(), sourceLanguage, targetLanguage, serviceInstanceKey]);
}

export function isOnDemandService(onDemandServiceList, serviceInstanceKey) {
    return Array.isArray(onDemandServiceList) && onDemandServiceList.includes(serviceInstanceKey);
}

export function shouldInvokeOnExpand(onDemand, fingerprint, requestedFingerprint) {
    return onDemand && fingerprint !== requestedFingerprint;
}

export function shouldPrepareTranslationContext(onDemand, fingerprint, lastOnDemandFingerprint) {
    return !onDemand || fingerprint !== lastOnDemandFingerprint;
}

export function isCurrentTranslationRequest(
    currentFingerprint,
    requestFingerprint,
    currentGeneration,
    requestGeneration
) {
    return currentFingerprint === requestFingerprint && currentGeneration === requestGeneration;
}
