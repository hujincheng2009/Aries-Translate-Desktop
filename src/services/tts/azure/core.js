export function normalizeAzureConfig(config = {}) {
    if (!config || typeof config !== 'object') config = {};

    const key = typeof config.key === 'string' ? config.key.trim() : '';
    const region = typeof config.region === 'string' ? config.region.trim().toLowerCase() : '';
    const rawEndpoint = typeof config.endpoint === 'string' ? config.endpoint.trim() : '';

    if (!key) throw new Error('Azure Speech key is required.');
    if (!region) throw new Error('Azure Speech region is required.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(region)) {
        throw new Error('Enter a valid Azure Speech region, such as westeurope.');
    }

    let endpoint = '';
    if (rawEndpoint) {
        let parsedEndpoint;
        try {
            parsedEndpoint = new URL(rawEndpoint);
        } catch {
            throw new Error('Enter a valid Azure Speech resource endpoint.');
        }

        if (
            parsedEndpoint.protocol !== 'https:' ||
            !parsedEndpoint.hostname.toLowerCase().endsWith('.cognitiveservices.azure.com') ||
            (parsedEndpoint.port !== '' && parsedEndpoint.port !== '443') ||
            (parsedEndpoint.pathname !== '' && parsedEndpoint.pathname !== '/') ||
            parsedEndpoint.search ||
            parsedEndpoint.hash ||
            parsedEndpoint.username ||
            parsedEndpoint.password
        ) {
            throw new Error('The resource endpoint must be an HTTPS Azure Cognitive Services endpoint.');
        }

        endpoint = parsedEndpoint.origin;
    }

    return { key, region, endpoint };
}

export function getAzureSpeechUrl({ region, endpoint }) {
    return endpoint
        ? `${endpoint}/cognitiveservices/v1`
        : `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

export function getAzureVoicesUrl({ region, endpoint }) {
    return endpoint
        ? `${endpoint}/tts/cognitiveservices/voices/list`
        : `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
}

export function supportsAzureLocale(voice, locale) {
    const normalizedLocale = locale.toLowerCase();
    return (
        voice.Locale?.toLowerCase() === normalizedLocale ||
        (Array.isArray(voice.SecondaryLocaleList) &&
            voice.SecondaryLocaleList.some((secondaryLocale) => secondaryLocale.toLowerCase() === normalizedLocale))
    );
}

export function resolveAzureSettingsLocale(config, locales, fallback) {
    const savedLocale = config?.settingsLocale;
    if (locales.includes(savedLocale)) return savedLocale;
    return locales.find((locale) => config?.voiceOverrides?.[locale]) ?? fallback;
}

function voiceSortScore(voice, locale) {
    return [
        voice.Locale?.toLowerCase() === locale.toLowerCase() ? 0 : 1,
        voice.VoiceType?.toLowerCase() === 'neural' ? 0 : 1,
        voice.Status?.toLowerCase() === 'ga' ? 0 : 1,
        voice.Gender?.toLowerCase() === 'female' ? 0 : 1,
        voice.ShortName ?? '',
    ];
}

function compareScores(left, right) {
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] < right[index]) return -1;
        if (left[index] > right[index]) return 1;
    }
    return 0;
}

export function resolveAzureVoice(voices, locale, config = {}) {
    const configuredVoice = config.voiceOverrides?.[locale];
    if (configuredVoice) {
        const voice = voices.find((item) => item.ShortName === configuredVoice && supportsAzureLocale(item, locale));
        if (!voice) {
            throw new Error(`The selected Azure voice is unavailable for ${locale}. Refresh the voice list or choose another voice.`);
        }
        return voice;
    }

    const candidates = voices.filter((voice) => supportsAzureLocale(voice, locale));
    if (candidates.length === 0) throw new Error(`Azure Speech has no voice for ${locale} in this region.`);

    candidates.sort((left, right) => compareScores(voiceSortScore(left, locale), voiceSortScore(right, locale)));
    return candidates[0];
}

function escapeXmlText(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function escapeXmlAttribute(value) {
    return escapeXmlText(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function buildAzureSsml(text, locale, voiceShortName) {
    return `<speak version="1.0" xml:lang="${escapeXmlAttribute(locale)}"><voice name="${escapeXmlAttribute(voiceShortName)}" xml:lang="${escapeXmlAttribute(locale)}">${escapeXmlText(text)}</voice></speak>`;
}
