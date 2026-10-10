export const info = {
    name: 'azure_ocr',
    icon: 'logo/azure.svg',
};

// Aries languages listed as supported by the Read printed-text model. Read detects the language itself,
// so these values only mark support and are never sent to the API.
// https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/language-support
export const Language = Object.freeze({
    auto: 'auto',
    zh_cn: 'zh_cn',
    zh_tw: 'zh_tw',
    en: 'en',
    ja: 'ja',
    ko: 'ko',
    fr: 'fr',
    es: 'es',
    ru: 'ru',
    de: 'de',
    it: 'it',
    tr: 'tr',
    pt_pt: 'pt_pt',
    pt_br: 'pt_br',
    id: 'id',
    ms: 'ms',
    ar: 'ar',
    hi: 'hi',
    mn_cy: 'mn_cy',
    nb_no: 'nb_no',
    nn_no: 'nn_no',
    fa: 'fa',
    sv: 'sv',
    pl: 'pl',
    nl: 'nl',
});
