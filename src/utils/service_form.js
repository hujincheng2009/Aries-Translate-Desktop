import { serviceAliases, getServiceMeta } from '../services/service_meta.js';

const required = {
    translate: {
        alibaba: ['accesskey_id', 'accesskey_secret'],
        azure: ['key'],
        baidu: ['appid', 'secret'],
        baidu_field: ['appid', 'secret', 'field'],
        caiyun: ['token'],
        chatglm: ['apiKey', 'model'],
        deepl: ['authKey', 'customUrl'],
        geminipro: ['apiKey', 'requestPath'],
        gemini_free: ['apiKey', 'models', 'userPrompt'],
        google_cloud: ['apiKey'],
        niutrans: ['apikey'],
        ollama: ['requestPath', 'model'],
        openai: ['requestPath', 'apiKey', 'model'],
        tencent: ['secret_id', 'secret_key'],
        volcengine: ['appid', 'secret'],
        youdao: ['appkey', 'key'],
    },
    recognize: {
        azure_ocr: ['key', 'endpoint'],
        google_ocr: ['api_key'],
        baidu: ['client_id', 'client_secret'],
        baidu_accurate: ['client_id', 'client_secret'],
        baidu_img: ['appid', 'secret'],
        iflytek: ['appid', 'apikey', 'apisecret'],
        iflytek_intsig: ['appid', 'apikey', 'apisecret'],
        iflytek_latex: ['appid', 'apikey', 'apisecret'],
        simple_latex: ['token'],
        tencent: ['secret_id', 'secret_key'],
        tencent_accurate: ['secret_id', 'secret_key'],
        tencent_img: ['secret_id', 'secret_key'],
        volcengine: ['appid', 'secret'],
        volcengine_multi_lang: ['appid', 'secret'],
    },
    tts: {
        azure: ['key', 'region'],
        gemini: ['apiKey', 'model'],
        gemini_live: ['apiKey', 'model'],
        google_cloud: ['credential'],
        openrouter: ['apiKey', 'model'],
    },
    collection: { anki: ['port'], eudic: ['name', 'token'] },
};

// Only visible fields register with the dialog. Conditional API/DeepLX/Azure fields retain their existing behavior.
export function requiredServiceFields(serviceName, serviceType) {
    return required[serviceType]?.[serviceAliases[serviceName] ?? serviceName] ?? [];
}

export function hasRequiredValue(value) {
    if (Array.isArray(value)) return value.some(hasRequiredValue);
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== undefined && value !== null && value !== false;
}

export function filterServiceItems(items, { query = '', tag = 'all', serviceType, translate = (key) => key } = {}) {
    const keyword = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
        const meta = getServiceMeta(item.key, serviceType);
        if (tag !== 'all' && !meta?.tags.includes(tag)) return false;
        return (
            !keyword ||
            [item.name, item.key, meta?.summaryKey ? translate(meta.summaryKey) : ''].some((text) =>
                text.toLocaleLowerCase().includes(keyword)
            )
        );
    });
}
