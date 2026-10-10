import assert from 'node:assert/strict';
import test from 'node:test';

import {
    GOOGLE_CLOUD_TTS_DEFAULT_URL,
    GOOGLE_CLOUD_TTS_LANGUAGE_CODES,
    buildGoogleCloudRequest,
    decodeGoogleCloudAudio,
    filterGoogleVoices,
    getGoogleCloudVoicesUrl,
    getGoogleVoiceFamily,
    getGoogleVoiceLanguageCode,
    listGoogleVoiceFamilies,
    listGoogleVoiceGenders,
    listGoogleVoiceRegions,
    needsGoogleCloudVoiceList,
    normalizeGoogleCloudConfig,
    normalizeGoogleVoiceList,
    parseGoogleCloudResponse,
    parseGoogleCloudVoicesResponse,
    resolveGoogleCloudSettingsLanguage,
    resolveGoogleCloudVoice,
} from '../src/services/tts/google_cloud/core.js';

test('Google Cloud TTS builds the default API-key request and voice mapping', () => {
    const request = buildGoogleCloudRequest(' Dzień dobry ', 'pl', {
        credential: 'google-cloud-key',
        voice: 'standard_female',
    });
    assert.equal(request.url, GOOGLE_CLOUD_TTS_DEFAULT_URL);
    assert.equal(request.url.includes('google-cloud-key'), false);
    assert.equal(request.headers['x-goog-api-key'], 'google-cloud-key');
    assert.equal('Authorization' in request.headers, false);
    assert.deepEqual(request.payload, {
        input: { text: 'Dzień dobry' },
        voice: { languageCode: 'pl-PL', name: 'pl-PL-Standard-F' },
        audioConfig: { audioEncoding: 'MP3' },
    });
});

test('Google Cloud TTS supports OAuth Bearer auth and a complete custom URL', () => {
    const request = buildGoogleCloudRequest('Hello', 'en', {
        credential: 'oauth-access-token',
        authType: 'bearer',
        requestPath: ' https://eu-texttospeech.googleapis.com/v1/text:synthesize ',
    });
    assert.equal(request.url, 'https://eu-texttospeech.googleapis.com/v1/text:synthesize');
    assert.equal(request.headers.Authorization, 'Bearer oauth-access-token');
    assert.equal('x-goog-api-key' in request.headers, false);
});

test('Google Cloud TTS preserves all supported standard and Chirp 3 voice mappings', () => {
    assert.deepEqual(resolveGoogleCloudVoice('zh_cn', 'auto'), {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Standard-D',
    });
    assert.deepEqual(resolveGoogleCloudVoice('zh_cn', 'standard_male'), {
        languageCode: 'cmn-CN',
        name: 'cmn-CN-Standard-B',
    });
    assert.deepEqual(resolveGoogleCloudVoice('pl', 'chirp3_puck'), {
        languageCode: 'pl-PL',
        name: 'pl-PL-Chirp3-HD-Puck',
    });
    assert.throws(() => resolveGoogleCloudVoice('mn_cy', 'auto'), /Language not supported/);
    assert.throws(() => resolveGoogleCloudVoice('de', 'auto'), /needs the voice list/);
});

test('Google Cloud TTS passes audio controls to Standard and only speed to Chirp 3 voices', () => {
    const config = {
        credential: 'key',
        voice: 'standard_female',
        audioEncoding: 'LINEAR16',
        speakingRate: '1.25',
        pitch: '-2',
        volumeGainDb: '3',
        sampleRateHertz: '24000',
        effectsProfileId: 'headphone-class-device, telephony-class-application',
    };
    assert.deepEqual(buildGoogleCloudRequest('Test', 'en', config).payload.audioConfig, {
        audioEncoding: 'LINEAR16',
        speakingRate: 1.25,
        pitch: -2,
        volumeGainDb: 3,
        sampleRateHertz: 24000,
        effectsProfileId: ['headphone-class-device', 'telephony-class-application'],
    });

    const chirp = buildGoogleCloudRequest('Test', 'en', { ...config, voice: 'chirp3_kore' });
    assert.deepEqual(chirp.payload.audioConfig, {
        audioEncoding: 'LINEAR16',
        speakingRate: 1.25,
        volumeGainDb: 3,
        sampleRateHertz: 24000,
        effectsProfileId: ['headphone-class-device', 'telephony-class-application'],
    });
});

test('Google Cloud TTS rejects invalid request values before network use', () => {
    assert.throws(() => normalizeGoogleCloudConfig({}), /credential is required/);
    assert.throws(() => normalizeGoogleCloudConfig({ credential: 'key', authType: 'basic' }), /authentication type/);
    assert.throws(() => normalizeGoogleCloudConfig({ credential: 'key', audioEncoding: 'WAVE' }), /audio encoding/);
    assert.throws(() => normalizeGoogleCloudConfig({ credential: 'key', requestPath: 'ftp://example.com' }), /HTTP or HTTPS/);
    assert.throws(() => buildGoogleCloudRequest('Hello', 'en', { credential: 'key', pitch: '21' }), /pitch/);
    assert.throws(() => buildGoogleCloudRequest('Hello', 'en', { credential: 'key', sampleRateHertz: '24k' }), /sample rate/);
    assert.throws(() => buildGoogleCloudRequest(' ', 'en', { credential: 'key' }), /Text to synthesize/);
});

test('Google Cloud TTS decodes audio bytes and reports missing or malformed audio clearly', () => {
    assert.deepEqual(decodeGoogleCloudAudio('SUQz'), [73, 68, 51]);
    assert.throws(() => decodeGoogleCloudAudio(''), /no audio/);
    assert.throws(() => decodeGoogleCloudAudio('not base64!'), /invalid audio/);
    assert.deepEqual(parseGoogleCloudResponse(200, { audioContent: 'SUQz' }, 'key'), [73, 68, 51]);
});

test('Google Cloud TTS HTTP errors do not expose API keys or Bearer credentials', () => {
    const credential = 'google-cloud-private-token';
    assert.throws(
        () => parseGoogleCloudResponse(401, { error: { message: `Rejected ${credential} Bearer ${credential}` } }, credential),
        (error) => {
            assert.match(error.message, /HTTP 401/);
            assert.match(error.message, /\[REDACTED\]/);
            assert.doesNotMatch(error.message, /google-cloud-private-token/);
            return true;
        }
    );
});

const SAMPLE_VOICES = normalizeGoogleVoiceList([
    { name: 'en-US-Standard-C', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
    { name: 'en-US-Wavenet-F', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
    { name: 'en-US-Wavenet-D', languageCodes: ['en-US'], ssmlGender: 'MALE' },
    { name: 'en-US-Studio-O', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
    { name: 'en-US-Chirp-HD-F', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
    { name: 'en-US-News-K', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
    { name: 'Kore', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
    { name: 'en-GB-Neural2-A', languageCodes: ['en-GB'], ssmlGender: 'FEMALE' },
    { name: 'en-GB-Neural2-B', languageCodes: ['en-GB'], ssmlGender: 'MALE' },
    { name: 'de-DE-Standard-B', languageCodes: ['de-DE'], ssmlGender: 'MALE' },
    { name: 'de-DE-Standard-A', languageCodes: ['de-DE'], ssmlGender: 'FEMALE' },
    { name: 'de-DE-Standard-G', languageCodes: ['de-DE'], ssmlGender: 'FEMALE' },
    { name: 'cmn-CN-Wavenet-A', languageCodes: ['cmn-CN'], ssmlGender: 'FEMALE' },
    { name: 'cmn-TW-Wavenet-A', languageCodes: ['cmn-TW'], ssmlGender: 'FEMALE' },
    { name: 'pt-PT-Wavenet-E', languageCodes: ['pt-PT'], ssmlGender: 'FEMALE' },
    { name: 'pt-BR-Neural2-A', languageCodes: ['pt-BR'], ssmlGender: 'FEMALE' },
]);

test('Google Cloud TTS recognizes only free-tier voice families', () => {
    assert.equal(getGoogleVoiceFamily('en-US-Standard-C'), 'standard');
    assert.equal(getGoogleVoiceFamily('en-US-Wavenet-F'), 'wavenet');
    assert.equal(getGoogleVoiceFamily('en-GB-Neural2-A'), 'neural2');
    assert.equal(getGoogleVoiceFamily('de-DE-Polyglot-1'), 'polyglot');
    assert.equal(getGoogleVoiceFamily('pl-PL-Chirp3-HD-Kore'), 'chirp3_hd');
    assert.equal(getGoogleVoiceFamily('en-US-Studio-O'), 'studio');
    for (const name of ['Kore', 'en-US-Chirp-HD-F', 'en-US-Journey-D', 'en-US-News-K', 'en-US-Casual-K', 'gemini-2.5-flash-tts']) {
        assert.equal(getGoogleVoiceFamily(name), null, name);
    }
    assert.deepEqual(
        SAMPLE_VOICES.filter((voice) => voice.languageCode === 'en-US').map((voice) => voice.name),
        ['en-US-Standard-C', 'en-US-Wavenet-D', 'en-US-Wavenet-F', 'en-US-Studio-O']
    );
});

test('Google Cloud TTS derives the request language code from the voice name', () => {
    assert.equal(getGoogleVoiceLanguageCode('en-GB-Neural2-A'), 'en-GB');
    assert.equal(getGoogleVoiceLanguageCode('cmn-CN-Wavenet-A'), 'cmn-CN');
    assert.equal(getGoogleVoiceLanguageCode('ar-XA-Standard-A'), 'ar-XA');
    assert.equal(getGoogleVoiceLanguageCode('Kore'), '');
});

test('Google Cloud TTS supports the Pot languages that have free-tier voices', () => {
    assert.equal(Object.keys(GOOGLE_CLOUD_TTS_LANGUAGE_CODES).length, 25);
    for (const language of ['mn_cy', 'mn_mo', 'km', 'nn_no', 'fa']) {
        assert.equal(language in GOOGLE_CLOUD_TTS_LANGUAGE_CODES, false, language);
    }
    assert.equal(GOOGLE_CLOUD_TTS_LANGUAGE_CODES.ar, 'ar-XA');
});

test('Google Cloud TTS lists regions with the Chinese and Portuguese exceptions', () => {
    assert.deepEqual(listGoogleVoiceRegions(SAMPLE_VOICES, 'en'), ['en-US', 'en-GB']);
    assert.deepEqual(listGoogleVoiceRegions(SAMPLE_VOICES, 'zh_cn'), ['cmn-CN']);
    assert.deepEqual(listGoogleVoiceRegions(SAMPLE_VOICES, 'zh_tw'), ['cmn-TW']);
    assert.deepEqual(listGoogleVoiceRegions(SAMPLE_VOICES, 'pt_pt'), ['pt-PT']);
    assert.deepEqual(listGoogleVoiceRegions(SAMPLE_VOICES, 'pt_br'), ['pt-BR']);
});

test('Google Cloud TTS filters voices by family and gender and keeps the saved voice', () => {
    assert.deepEqual(listGoogleVoiceFamilies(SAMPLE_VOICES, 'en-US'), ['standard', 'wavenet', 'studio']);
    assert.deepEqual(listGoogleVoiceGenders(SAMPLE_VOICES, 'en-US', 'wavenet'), ['FEMALE', 'MALE']);
    assert.deepEqual(
        filterGoogleVoices(SAMPLE_VOICES, { region: 'en-US', family: 'wavenet', gender: 'MALE' }).map((voice) => voice.name),
        ['en-US-Wavenet-D']
    );
    assert.deepEqual(
        filterGoogleVoices(SAMPLE_VOICES, { region: 'en-US', family: 'wavenet', gender: 'MALE', keep: 'en-US-Studio-O' }).map(
            (voice) => voice.name
        ),
        ['en-US-Studio-O', 'en-US-Wavenet-D']
    );
    assert.deepEqual(filterGoogleVoices([], { region: 'en-US', keep: 'en-GB-Neural2-A' }), [
        { name: 'en-GB-Neural2-A', languageCode: 'en-GB', family: 'neural2', gender: '' },
    ]);
});

test('Google Cloud TTS resolves per-language voices before the default rule', () => {
    const config = { credential: 'key', voice: 'chirp3_kore', voiceOverrides: { en: 'en-GB-Neural2-A' } };
    assert.deepEqual(buildGoogleCloudRequest('Hello', 'en', config).payload.voice, {
        languageCode: 'en-GB',
        name: 'en-GB-Neural2-A',
    });
    assert.deepEqual(buildGoogleCloudRequest('Dzień dobry', 'pl', config).payload.voice, {
        languageCode: 'pl-PL',
        name: 'pl-PL-Chirp3-HD-Kore',
    });
    assert.deepEqual(resolveGoogleCloudVoice('en', 'standard_male'), { languageCode: 'en-US', name: 'en-US-Standard-B' });
});

test('Google Cloud TTS picks a Standard voice by gender and name for newly supported languages', () => {
    assert.equal(needsGoogleCloudVoiceList('de', { credential: 'key' }), true);
    assert.equal(needsGoogleCloudVoiceList('en', { credential: 'key' }), false);
    assert.equal(needsGoogleCloudVoiceList('de', { credential: 'key', voice: 'chirp3_kore' }), false);
    assert.equal(needsGoogleCloudVoiceList('de', { credential: 'key', voiceOverrides: { de: 'de-DE-Standard-B' } }), false);
    assert.deepEqual(resolveGoogleCloudVoice('de', 'auto', { voices: SAMPLE_VOICES }), {
        languageCode: 'de-DE',
        name: 'de-DE-Standard-A',
    });
    assert.deepEqual(resolveGoogleCloudVoice('de', 'standard_male', { voices: SAMPLE_VOICES }), {
        languageCode: 'de-DE',
        name: 'de-DE-Standard-B',
    });
    assert.throws(() => resolveGoogleCloudVoice('ja', 'auto', { voices: SAMPLE_VOICES }), /no Standard voice/);
});

test('Google Cloud TTS rejects voice overrides outside the free families or the language', () => {
    assert.throws(
        () => normalizeGoogleCloudConfig({ credential: 'key', voiceOverrides: { en: 'en-US-Chirp-HD-F' } }),
        /not in a supported voice family/
    );
    assert.throws(
        () => normalizeGoogleCloudConfig({ credential: 'key', voiceOverrides: { en: 'de-DE-Standard-A' } }),
        /does not match/
    );
    assert.throws(
        () => normalizeGoogleCloudConfig({ credential: 'key', voiceOverrides: { zh_tw: 'cmn-CN-Wavenet-A' } }),
        /does not match/
    );
    assert.throws(
        () => normalizeGoogleCloudConfig({ credential: 'key', voiceOverrides: { fa: 'fa-IR-Standard-A' } }),
        /does not support/
    );
    assert.deepEqual(normalizeGoogleCloudConfig({ credential: 'key', voiceOverrides: { en: ' ' } }).voiceOverrides, {});
});

test('Google Cloud TTS sends speed but not pitch to Studio and Chirp 3 HD overrides', () => {
    const config = {
        credential: 'key',
        speakingRate: '1.25',
        pitch: '2',
        voiceOverrides: { en: 'en-US-Studio-O', pl: 'pl-PL-Chirp3-HD-Kore' },
    };
    assert.deepEqual(buildGoogleCloudRequest('Hi', 'en', config).payload.audioConfig, {
        audioEncoding: 'MP3',
        speakingRate: 1.25,
    });
    assert.deepEqual(buildGoogleCloudRequest('Hi', 'pl', config).payload.audioConfig, {
        audioEncoding: 'MP3',
        speakingRate: 1.25,
    });
});

test('Google Cloud TTS derives the voice list URL and refuses custom URLs it cannot map', () => {
    assert.equal(getGoogleCloudVoicesUrl(''), 'https://texttospeech.googleapis.com/v1/voices');
    assert.equal(
        getGoogleCloudVoicesUrl('https://eu-texttospeech.googleapis.com/v1/text:synthesize'),
        'https://eu-texttospeech.googleapis.com/v1/voices'
    );
    assert.throws(() => getGoogleCloudVoicesUrl('https://proxy.example.com/tts'), /Cannot derive/);
});

test('Google Cloud TTS parses the voice list and keeps credentials out of its errors', () => {
    assert.deepEqual(
        parseGoogleCloudVoicesResponse(200, {
            voices: [{ name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' }, { name: 'Kore' }],
        }).map((voice) => voice.name),
        ['en-US-Wavenet-F']
    );
    assert.throws(() => parseGoogleCloudVoicesResponse(200, {}), /invalid voice list/);
    assert.throws(
        () => parseGoogleCloudVoicesResponse(403, { error: { message: 'Denied secret-voice-key' } }, 'secret-voice-key'),
        (error) => {
            assert.match(error.message, /HTTP 403/);
            assert.doesNotMatch(error.message, /secret-voice-key/);
            return true;
        }
    );
});

test('Google Cloud TTS settings reopen on the saved language, then on a language with a voice', () => {
    assert.equal(resolveGoogleCloudSettingsLanguage(null, 'en'), 'en');
    assert.equal(resolveGoogleCloudSettingsLanguage({ voiceOverrides: { de: 'de-DE-Standard-A' } }, 'en'), 'de');
    assert.equal(
        resolveGoogleCloudSettingsLanguage({ settingsLanguage: 'pl', voiceOverrides: { de: 'de-DE-Standard-A' } }, 'en'),
        'pl'
    );
    assert.equal(resolveGoogleCloudSettingsLanguage({ settingsLanguage: 'fa' }, 'en'), 'en');
});
