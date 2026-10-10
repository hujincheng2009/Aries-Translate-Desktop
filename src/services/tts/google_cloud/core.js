export const GOOGLE_CLOUD_TTS_DEFAULT_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

export const GOOGLE_CLOUD_TTS_VOICE_OPTIONS = Object.freeze({
    auto: 'Automatic · Standard Female',
    standard_female: 'Standard · Female',
    standard_male: 'Standard · Male',
    chirp3_achernar: 'Chirp 3 HD · Achernar · Female',
    chirp3_achird: 'Chirp 3 HD · Achird · Male',
    chirp3_algenib: 'Chirp 3 HD · Algenib · Male',
    chirp3_algieba: 'Chirp 3 HD · Algieba · Male',
    chirp3_alnilam: 'Chirp 3 HD · Alnilam · Male',
    chirp3_aoede: 'Chirp 3 HD · Aoede · Female',
    chirp3_autonoe: 'Chirp 3 HD · Autonoe · Female',
    chirp3_callirrhoe: 'Chirp 3 HD · Callirrhoe · Female',
    chirp3_charon: 'Chirp 3 HD · Charon · Male',
    chirp3_despina: 'Chirp 3 HD · Despina · Female',
    chirp3_enceladus: 'Chirp 3 HD · Enceladus · Male',
    chirp3_erinome: 'Chirp 3 HD · Erinome · Female',
    chirp3_fenrir: 'Chirp 3 HD · Fenrir · Male',
    chirp3_gacrux: 'Chirp 3 HD · Gacrux · Female',
    chirp3_iapetus: 'Chirp 3 HD · Iapetus · Male',
    chirp3_kore: 'Chirp 3 HD · Kore · Female',
    chirp3_laomedeia: 'Chirp 3 HD · Laomedeia · Female',
    chirp3_leda: 'Chirp 3 HD · Leda · Female',
    chirp3_orus: 'Chirp 3 HD · Orus · Male',
    chirp3_puck: 'Chirp 3 HD · Puck · Male',
    chirp3_pulcherrima: 'Chirp 3 HD · Pulcherrima · Female',
    chirp3_rasalgethi: 'Chirp 3 HD · Rasalgethi · Male',
    chirp3_sadachbia: 'Chirp 3 HD · Sadachbia · Male',
    chirp3_sadaltager: 'Chirp 3 HD · Sadaltager · Male',
    chirp3_schedar: 'Chirp 3 HD · Schedar · Male',
    chirp3_sulafat: 'Chirp 3 HD · Sulafat · Female',
    chirp3_umbriel: 'Chirp 3 HD · Umbriel · Male',
    chirp3_vindemiatrix: 'Chirp 3 HD · Vindemiatrix · Female',
    chirp3_zephyr: 'Chirp 3 HD · Zephyr · Female',
    chirp3_zubenelgenubi: 'Chirp 3 HD · Zubenelgenubi · Male',
});

// Aries languages with at least one voice in a free-tier family, per the official voice list (2026-10).
export const GOOGLE_CLOUD_TTS_LANGUAGE_CODES = Object.freeze({
    zh_cn: 'cmn-CN',
    zh_tw: 'cmn-TW',
    en: 'en-US',
    ja: 'ja-JP',
    ko: 'ko-KR',
    fr: 'fr-FR',
    es: 'es-ES',
    ru: 'ru-RU',
    de: 'de-DE',
    it: 'it-IT',
    tr: 'tr-TR',
    pt_pt: 'pt-PT',
    pt_br: 'pt-BR',
    vi: 'vi-VN',
    id: 'id-ID',
    th: 'th-TH',
    ms: 'ms-MY',
    ar: 'ar-XA',
    hi: 'hi-IN',
    nb_no: 'nb-NO',
    sv: 'sv-SE',
    pl: 'pl-PL',
    nl: 'nl-NL',
    uk: 'uk-UA',
    he: 'he-IL',
});

// Only families with a monthly free quota. Anything else (Gemini-TTS, Chirp HD, Journey, News, Casual...) is hidden.
export const GOOGLE_CLOUD_TTS_FAMILIES = Object.freeze([
    'standard',
    'wavenet',
    'neural2',
    'polyglot',
    'chirp3_hd',
    'studio',
]);
export const GOOGLE_CLOUD_TTS_GENDERS = Object.freeze(['FEMALE', 'MALE', 'NEUTRAL']);

const FAMILY_MARKERS = {
    standard: '-Standard-',
    wavenet: '-Wavenet-',
    neural2: '-Neural2-',
    polyglot: '-Polyglot-',
    chirp3_hd: '-Chirp3-HD-',
    studio: '-Studio-',
};
const EXACT_REGIONS = {
    zh_cn: ['cmn-CN'],
    zh_tw: ['cmn-TW'],
    pt_pt: ['pt-PT'],
    pt_br: ['pt-BR'],
};
const STANDARD_FEMALE_VOICES = {
    zh_cn: 'cmn-CN-Standard-D',
    en: 'en-US-Standard-C',
    pl: 'pl-PL-Standard-F',
};
const STANDARD_MALE_VOICES = {
    zh_cn: 'cmn-CN-Standard-B',
    en: 'en-US-Standard-B',
    pl: 'pl-PL-Standard-G',
};
const VOICE_NAME_PATTERN = /^([a-z]{2,3}-[A-Z]{2})-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;
const SYNTHESIZE_PATH_SUFFIX = 'text:synthesize';
const VALID_AUDIO_ENCODINGS = new Set(['MP3', 'LINEAR16', 'OGG_OPUS']);
const VALID_AUTH_TYPES = new Set(['api_key', 'bearer']);
const CHIRP3_PREFIX = 'chirp3_';
const MAX_ERROR_DETAIL_LENGTH = 2000;

function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

export function getGoogleVoiceLanguageCode(name) {
    const match = toTrimmedString(name).match(VOICE_NAME_PATTERN);
    return match ? match[1] : '';
}

export function getGoogleVoiceFamily(name) {
    const voiceName = toTrimmedString(name);
    const languageCode = getGoogleVoiceLanguageCode(voiceName);
    if (!languageCode) return null;
    const rest = voiceName.slice(languageCode.length);
    return GOOGLE_CLOUD_TTS_FAMILIES.find((family) => rest.startsWith(FAMILY_MARKERS[family])) ?? null;
}

export function isGoogleVoiceCodeForLanguage(language, languageCode) {
    const defaultCode = GOOGLE_CLOUD_TTS_LANGUAGE_CODES[language];
    if (!defaultCode || !languageCode) return false;
    if (EXACT_REGIONS[language]) return EXACT_REGIONS[language].includes(languageCode);
    return languageCode.split('-')[0] === defaultCode.split('-')[0];
}

export function normalizeGoogleCloudRequestUrl(value) {
    const requestUrl = toTrimmedString(value) || GOOGLE_CLOUD_TTS_DEFAULT_URL;
    let parsed;
    try {
        parsed = new URL(requestUrl);
    } catch {
        throw new Error('Google Cloud TTS request URL is invalid.');
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || parsed.username || parsed.password) {
        throw new Error('Google Cloud TTS request URL must be a credential-free HTTP or HTTPS URL.');
    }
    return requestUrl;
}

export function getGoogleCloudVoicesUrl(requestUrl) {
    const parsed = new URL(normalizeGoogleCloudRequestUrl(requestUrl));
    if (!parsed.pathname.endsWith(`/${SYNTHESIZE_PATH_SUFFIX}`)) {
        throw new Error('Cannot derive the Google Cloud TTS voice list URL from the custom request URL.');
    }
    parsed.pathname = `${parsed.pathname.slice(0, -SYNTHESIZE_PATH_SUFFIX.length)}voices`;
    return parsed.toString();
}

function normalizeOptionalNumber(value, { name, min, max, integer = false }) {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
        throw new Error(`Google Cloud TTS ${name} value is invalid.`);
    }
    return number;
}

function normalizeVoiceOverrides(value) {
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value))
        throw new Error('Google Cloud TTS voice overrides are invalid.');

    const overrides = {};
    for (const [language, rawName] of Object.entries(value)) {
        const name = toTrimmedString(rawName);
        if (!name) continue;
        if (!hasOwn(GOOGLE_CLOUD_TTS_LANGUAGE_CODES, language)) {
            throw new Error(`Google Cloud TTS does not support a voice setting for ${language}.`);
        }
        if (!getGoogleVoiceFamily(name)) {
            throw new Error(`Google Cloud TTS voice ${name} is not in a supported voice family.`);
        }
        if (!isGoogleVoiceCodeForLanguage(language, getGoogleVoiceLanguageCode(name))) {
            throw new Error(`Google Cloud TTS voice ${name} does not match the language ${language}.`);
        }
        overrides[language] = name;
    }
    return overrides;
}

export function normalizeGoogleCloudConfig(config = {}) {
    const credential = toTrimmedString(config?.credential);
    if (!credential) throw new Error('Google Cloud TTS credential is required.');
    const authType = toTrimmedString(config?.authType) || 'api_key';
    if (!VALID_AUTH_TYPES.has(authType)) throw new Error('Google Cloud TTS authentication type is invalid.');
    const audioEncoding = toTrimmedString(config?.audioEncoding) || 'MP3';
    if (!VALID_AUDIO_ENCODINGS.has(audioEncoding)) throw new Error('Google Cloud TTS audio encoding is invalid.');

    const voice = toTrimmedString(config?.voice) || 'auto';
    if (!hasOwn(GOOGLE_CLOUD_TTS_VOICE_OPTIONS, voice)) {
        throw new Error('Google Cloud TTS voice selection is invalid.');
    }

    const speakingRate = normalizeOptionalNumber(config?.speakingRate, { name: 'speaking rate', min: 0.25, max: 2 });
    const pitch = normalizeOptionalNumber(config?.pitch, { name: 'pitch', min: -20, max: 20 });
    const volumeGainDb = normalizeOptionalNumber(config?.volumeGainDb, { name: 'volume gain', min: -96, max: 16 });
    const sampleRateHertz = normalizeOptionalNumber(config?.sampleRateHertz, {
        name: 'sample rate',
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        integer: true,
    });
    const effectsProfileId = toTrimmedString(config?.effectsProfileId)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

    return {
        credential,
        authType,
        requestUrl: normalizeGoogleCloudRequestUrl(config?.requestPath),
        voice,
        voiceOverrides: normalizeVoiceOverrides(config?.voiceOverrides),
        audioEncoding,
        speakingRate,
        pitch,
        volumeGainDb,
        sampleRateHertz,
        effectsProfileId,
    };
}

export function resolveGoogleCloudSettingsLanguage(config, fallback) {
    const languages = Object.keys(GOOGLE_CLOUD_TTS_LANGUAGE_CODES);
    const savedLanguage = config?.settingsLanguage;
    if (languages.includes(savedLanguage)) return savedLanguage;
    return languages.find((language) => config?.voiceOverrides?.[language]) ?? fallback;
}

function compareVoices(left, right) {
    const familyOrder =
        GOOGLE_CLOUD_TTS_FAMILIES.indexOf(left.family) - GOOGLE_CLOUD_TTS_FAMILIES.indexOf(right.family);
    if (familyOrder !== 0) return familyOrder;
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
}

export function normalizeGoogleVoiceList(voices) {
    if (!Array.isArray(voices)) return [];
    return voices
        .filter((voice) => typeof voice?.name === 'string')
        .map((voice) => ({
            name: voice.name,
            languageCode: getGoogleVoiceLanguageCode(voice.name),
            family: getGoogleVoiceFamily(voice.name),
            gender: GOOGLE_CLOUD_TTS_GENDERS.includes(voice.ssmlGender) ? voice.ssmlGender : '',
        }))
        .filter((voice) => voice.family)
        .sort(compareVoices);
}

export function listGoogleVoiceRegions(voices, language) {
    const defaultCode = GOOGLE_CLOUD_TTS_LANGUAGE_CODES[language];
    const regions = [...new Set(voices.map((voice) => voice.languageCode))].filter((code) =>
        isGoogleVoiceCodeForLanguage(language, code)
    );
    return regions.sort((left, right) =>
        left === defaultCode ? -1 : right === defaultCode ? 1 : left.localeCompare(right)
    );
}

export function listGoogleVoiceFamilies(voices, region) {
    const present = new Set(voices.filter((voice) => voice.languageCode === region).map((voice) => voice.family));
    return GOOGLE_CLOUD_TTS_FAMILIES.filter((family) => present.has(family));
}

export function listGoogleVoiceGenders(voices, region, family = 'all') {
    const present = new Set(
        voices
            .filter((voice) => voice.languageCode === region && (family === 'all' || voice.family === family))
            .map((voice) => voice.gender)
    );
    return GOOGLE_CLOUD_TTS_GENDERS.filter((gender) => present.has(gender));
}

export function filterGoogleVoices(voices, { region, family = 'all', gender = 'all', keep = '' } = {}) {
    const result = voices.filter(
        (voice) =>
            voice.languageCode === region &&
            (family === 'all' || voice.family === family) &&
            (gender === 'all' || voice.gender === gender)
    );
    if (keep && !result.some((voice) => voice.name === keep)) {
        const saved = voices.find((voice) => voice.name === keep) ?? {
            name: keep,
            languageCode: getGoogleVoiceLanguageCode(keep),
            family: getGoogleVoiceFamily(keep),
            gender: '',
        };
        result.unshift(saved);
    }
    return result;
}

function usesStandardDefault(voiceChoice) {
    return !voiceChoice.startsWith(CHIRP3_PREFIX);
}

export function needsGoogleCloudVoiceList(language, config = {}) {
    const normalized = normalizeGoogleCloudConfig(config);
    return (
        hasOwn(GOOGLE_CLOUD_TTS_LANGUAGE_CODES, language) &&
        !normalized.voiceOverrides[language] &&
        usesStandardDefault(normalized.voice) &&
        !hasOwn(STANDARD_FEMALE_VOICES, language)
    );
}

export function resolveGoogleCloudVoice(language, voiceChoice = 'auto', options = {}) {
    const languageCode = GOOGLE_CLOUD_TTS_LANGUAGE_CODES[language];
    if (!languageCode) throw new Error('Language not supported by Google Cloud TTS.');
    if (!hasOwn(GOOGLE_CLOUD_TTS_VOICE_OPTIONS, voiceChoice)) {
        throw new Error('Google Cloud TTS voice selection is invalid.');
    }

    const override = options.voiceOverrides?.[language];
    if (override) return { languageCode: getGoogleVoiceLanguageCode(override), name: override };

    if (voiceChoice.startsWith(CHIRP3_PREFIX)) {
        const profile = voiceChoice.slice(CHIRP3_PREFIX.length);
        return { languageCode, name: `${languageCode}-Chirp3-HD-${profile[0].toUpperCase()}${profile.slice(1)}` };
    }

    const gender = voiceChoice === 'standard_male' ? 'MALE' : 'FEMALE';
    const legacyName = gender === 'MALE' ? STANDARD_MALE_VOICES[language] : STANDARD_FEMALE_VOICES[language];
    if (legacyName) return { languageCode, name: legacyName };

    if (!Array.isArray(options.voices)) {
        throw new Error('Google Cloud TTS needs the voice list to choose a Standard voice for this language.');
    }
    const candidate = options.voices
        .filter(
            (voice) => voice.family === 'standard' && voice.languageCode === languageCode && voice.gender === gender
        )
        .sort(compareVoices)[0];
    if (!candidate) {
        throw new Error(
            'Google Cloud TTS has no Standard voice with the selected gender for this language. Choose a voice for this language in the settings.'
        );
    }
    return { languageCode, name: candidate.name };
}

export function buildGoogleCloudAuthHeaders(normalized) {
    return normalized.authType === 'bearer'
        ? { Authorization: `Bearer ${normalized.credential}` }
        : { 'x-goog-api-key': normalized.credential };
}

export function buildGoogleCloudRequest(text, language, config = {}, voices) {
    const inputText = toTrimmedString(text);
    if (!inputText) throw new Error('Text to synthesize is required.');
    const normalized = normalizeGoogleCloudConfig(config);
    const voice = resolveGoogleCloudVoice(language, normalized.voice, {
        voiceOverrides: normalized.voiceOverrides,
        voices,
    });
    const family = getGoogleVoiceFamily(voice.name);
    const audioConfig = { audioEncoding: normalized.audioEncoding };

    // Chirp 3 HD supports pace control through speakingRate (verified by a real call), but neither it nor Studio supports pitch.
    if (normalized.speakingRate !== null) audioConfig.speakingRate = normalized.speakingRate;
    if (normalized.pitch !== null && family !== 'chirp3_hd' && family !== 'studio')
        audioConfig.pitch = normalized.pitch;
    if (normalized.volumeGainDb !== null) audioConfig.volumeGainDb = normalized.volumeGainDb;
    if (normalized.sampleRateHertz !== null) audioConfig.sampleRateHertz = normalized.sampleRateHertz;
    if (normalized.effectsProfileId.length > 0) audioConfig.effectsProfileId = normalized.effectsProfileId;

    return {
        url: normalized.requestUrl,
        credential: normalized.credential,
        headers: { 'Content-Type': 'application/json', ...buildGoogleCloudAuthHeaders(normalized) },
        payload: {
            input: { text: inputText },
            voice,
            audioConfig,
        },
    };
}

export function redactGoogleCloudError(value, credential = '') {
    let result = String(value ?? '');
    if (credential) result = result.split(credential).join('[REDACTED]');
    result = result.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
    return result.slice(0, MAX_ERROR_DETAIL_LENGTH);
}

function responseDataToText(data) {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
    if (ArrayBuffer.isView(data))
        return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    if (Array.isArray(data)) return new TextDecoder().decode(new Uint8Array(data));
    if (data === null || data === undefined) return '';
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}

function parseResponseBody(data) {
    if (typeof data === 'object' && data !== null && !ArrayBuffer.isView(data) && !(data instanceof ArrayBuffer))
        return data;
    const text = responseDataToText(data).trim();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { rawText: text };
    }
}

export function decodeGoogleCloudAudio(audioContent) {
    if (typeof audioContent !== 'string' || audioContent.trim() === '') {
        throw new Error('Google Cloud TTS returned no audio.');
    }
    try {
        const binary = atob(audioContent.replace(/\s/g, ''));
        return Array.from(binary, (character) => character.charCodeAt(0));
    } catch {
        throw new Error('Google Cloud TTS returned invalid audio data.');
    }
}

function throwIfGoogleCloudFailed(status, body, credential) {
    const statusNumber = Number.isFinite(Number(status)) ? Number(status) : 'UNKNOWN';
    if (statusNumber < 200 || statusNumber >= 300) {
        const detail = body?.error?.message ?? body?.message ?? body?.rawText ?? '';
        const safeDetail = redactGoogleCloudError(detail, credential);
        const prefix =
            statusNumber === 401 || statusNumber === 403
                ? `Google Cloud TTS rejected the credential or access (HTTP ${statusNumber}).`
                : statusNumber === 429
                  ? 'Google Cloud TTS quota was reached (HTTP 429).'
                  : Number(statusNumber) >= 500
                    ? `Google Cloud TTS is temporarily unavailable (HTTP ${statusNumber}).`
                    : `Google Cloud TTS request failed (HTTP ${statusNumber}).`;
        const error = new Error(safeDetail ? `${prefix} ${safeDetail}` : prefix);
        error.status = statusNumber;
        throw error;
    }
    if (body?.error) {
        const detail =
            typeof body.error.message === 'string' ? body.error.message : 'Google Cloud TTS returned an error.';
        const error = new Error(redactGoogleCloudError(detail, credential));
        error.status = Number(body.error.code) || Number(status);
        throw error;
    }
}

export function parseGoogleCloudResponse(status, data, credential = '') {
    const body = parseResponseBody(data);
    throwIfGoogleCloudFailed(status, body, credential);
    return decodeGoogleCloudAudio(body?.audioContent);
}

export function parseGoogleCloudVoicesResponse(status, data, credential = '') {
    const body = parseResponseBody(data);
    throwIfGoogleCloudFailed(status, body, credential);
    if (!Array.isArray(body?.voices)) throw new Error('Google Cloud TTS returned an invalid voice list.');
    return normalizeGoogleVoiceList(body.voices);
}
