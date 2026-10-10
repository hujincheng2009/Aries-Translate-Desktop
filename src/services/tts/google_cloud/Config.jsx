import { useServiceError } from '@/hooks/useServiceError';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import {
    ConfigField,
    ConfigFooter,
    ConfigForm,
    ConfigNote,
    InstanceNameField,
    SecretInput,
} from '@/components/app/ServiceConfigForm';
import OptionSelect from '@/components/app/OptionSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';

import { useToastStyle } from '../../../hooks';
import { useConfig } from '../../../hooks/useConfig';
import { playVoice } from '../../../hooks/useVoice';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import {
    GOOGLE_CLOUD_TTS_DEFAULT_URL,
    GOOGLE_CLOUD_TTS_LANGUAGE_CODES,
    filterGoogleVoices,
    getGoogleVoiceFamily,
    getGoogleVoiceLanguageCode,
    listGoogleVoiceFamilies,
    listGoogleVoiceGenders,
    listGoogleVoiceRegions,
    resolveGoogleCloudSettingsLanguage,
} from './core';
import { Language, VoiceOptions } from './info';
import { getGoogleCloudVoices, tts, validateGoogleCloudConfig } from './index';

const TEST_TEXT = {
    zh_cn: 'Aries 语音测试。',
    zh_tw: 'Aries 語音測試。',
    en: 'Hello from Aries. This is a short speech test.',
    ja: 'Aries の音声テストです。',
    ko: 'Aries 음성 테스트입니다.',
    fr: 'Test vocal Aries.',
    es: 'Prueba de voz de Aries.',
    ru: 'Проверка речи Aries.',
    de: 'Aries Sprachtest.',
    it: 'Test vocale di Aries.',
    tr: 'Aries ses testi.',
    pt_pt: 'Teste de voz do Aries.',
    pt_br: 'Teste de voz do Aries.',
    vi: 'Bài kiểm tra giọng nói Aries.',
    id: 'Tes suara Aries.',
    th: 'ทดสอบเสียง Aries',
    ms: 'Ujian suara Aries.',
    ar: 'اختبار صوت Aries',
    hi: 'Aries आवाज़ परीक्षण।',
    nb_no: 'Aries stemmetest.',
    sv: 'Rösttest för Aries.',
    pl: 'Test syntezy mowy w Aries.',
    nl: 'Aries-stemtest.',
    uk: 'Перевірка голосу Aries.',
    he: 'בדיקת קול של Aries.',
};
const AUTH_OPTIONS = [
    ['api_key', 'api_key_auth'],
    ['bearer', 'bearer_auth'],
];
const AUDIO_OPTIONS = ['MP3', 'LINEAR16', 'OGG_OPUS'];
const SPEAKING_RATE_OPTIONS = ['1', '0.25', '0.5', '0.75', '1.25', '1.5', '2'];
const ALL = 'all';
const DEFAULT_VOICE = '__default__';
const GENDER_LABEL_KEYS = { FEMALE: 'gender_female', MALE: 'gender_male', NEUTRAL: 'gender_neutral' };
const NO_FILTERS = { region: null, family: null, gender: null };

function SettingInput({ label, hint, value, onValueChange, type = 'text', secret = false, required = false }) {
    const Control = secret ? SecretInput : Input;
    return (
        <ConfigField
            label={label}
            hint={hint}
            required={required}
        >
            <Control
                {...(secret ? {} : { type })}
                value={value ?? ''}
                onChange={(e) => onValueChange(e.target.value)}
            />
        </ConfigField>
    );
}

function SettingSelect({ label, hint, value, options, onChange, isDisabled = false }) {
    const current = String(value);
    return (
        <ConfigField
            label={label}
            hint={hint}
        >
            <OptionSelect
                className='w-full'
                value={current}
                label={options.find(([key]) => key === current)?.[1]}
                disabled={isDisabled}
                options={options.map(([key, title]) => ({ value: key, label: title }))}
                onChange={(selected) => {
                    if (selected) onChange(selected);
                }}
            />
        </ConfigField>
    );
}

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const label = (key, values) => t(`services.tts.google_cloud_tts.${key}`, values);
    const toastStyle = useToastStyle();
    const [isTesting, setIsTesting] = useState(false);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [voices, setVoices] = useState(null);
    const [filters, setFilters] = useState(NO_FILTERS);
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.google_cloud_tts.title'),
            credential: '',
            authType: 'api_key',
            requestPath: GOOGLE_CLOUD_TTS_DEFAULT_URL,
            voice: 'auto',
            voiceOverrides: {},
            audioEncoding: 'MP3',
            speakingRate: '1',
            pitch: '',
            volumeGainDb: '',
            sampleRateHertz: '',
            effectsProfileId: '',
        },
        { sync: false }
    );
    const reportError = useServiceError(config);

    const setValue = (key, value) => setConfig({ ...config, [key]: value });
    const showError = (error) => {
        reportError(error);
    };

    if (config === null) return null;

    const voiceOverrides = config.voiceOverrides ?? {};
    const selectedLanguage = resolveGoogleCloudSettingsLanguage(config, Language.en);
    const savedVoice = voiceOverrides[selectedLanguage] ?? '';
    const voicesLoaded = Array.isArray(voices);
    const voiceList = voicesLoaded ? voices : [];
    const savedEntry = voiceList.find((voice) => voice.name === savedVoice);

    const regions = listGoogleVoiceRegions(voiceList, selectedLanguage);
    const derivedRegion = savedVoice
        ? getGoogleVoiceLanguageCode(savedVoice)
        : GOOGLE_CLOUD_TTS_LANGUAGE_CODES[selectedLanguage];
    const region =
        filters.region ??
        (!voicesLoaded || regions.includes(derivedRegion) ? derivedRegion : regions[0] ?? derivedRegion);

    const families = listGoogleVoiceFamilies(voiceList, region);
    const derivedFamily =
        savedVoice && getGoogleVoiceLanguageCode(savedVoice) === region ? getGoogleVoiceFamily(savedVoice) : ALL;
    let family = filters.family ?? derivedFamily;
    if (voicesLoaded && family !== ALL && !families.includes(family)) family = ALL;

    const genders = listGoogleVoiceGenders(voiceList, region, family);
    const derivedGender =
        savedEntry && savedEntry.languageCode === region && (family === ALL || savedEntry.family === family)
            ? savedEntry.gender || ALL
            : ALL;
    let gender = filters.gender ?? derivedGender;
    if (gender !== ALL && !genders.includes(gender)) gender = ALL;

    const voiceItems = filterGoogleVoices(voiceList, { region, family, gender, keep: savedVoice });

    const changeLanguage = (value) => {
        setFilters(NO_FILTERS);
        setConfig({ ...config, settingsLanguage: value });
    };
    const changeVoice = (value) => {
        const nextOverrides = { ...voiceOverrides };
        if (value === DEFAULT_VOICE) delete nextOverrides[selectedLanguage];
        else nextOverrides[selectedLanguage] = value;
        setConfig({ ...config, voiceOverrides: nextOverrides });
    };

    const loadVoices = async () => {
        setIsLoadingVoices(true);
        try {
            const voiceListResult = await getGoogleCloudVoices(config, { refresh: true });
            setVoices(voiceListResult);
            toast.success(label('voices_loaded', { count: voiceListResult.length }), { style: toastStyle });
        } catch (error) {
            showError(error);
        } finally {
            setIsLoadingVoices(false);
        }
    };

    const testVoice = async () => {
        setIsTesting(true);
        try {
            validateGoogleCloudConfig(config);
            const audio = await tts(TEST_TEXT[selectedLanguage], selectedLanguage, { config });
            await playVoice(audio);
            toast.success(label('test_success'), { style: toastStyle });
        } catch (error) {
            showError(error);
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = () => {
        try {
            validateGoogleCloudConfig(config);
            setConfig(config, true);
            updateServiceList(instanceKey);
            onClose();
        } catch (error) {
            showError(error);
        }
    };

    const genderLabel = (value) => (GENDER_LABEL_KEYS[value] ? label(GENDER_LABEL_KEYS[value]) : '');
    const languageOptions = Object.keys(Language).map((language) => [
        language,
        voiceOverrides[language] ? `${t(`languages.${language}`)} · ${label('voice_set')}` : t(`languages.${language}`),
    ]);
    const regionOptions = (voicesLoaded ? regions : [region]).map((code) => [code, code]);
    const familyOptions = [
        [ALL, label('family_all')],
        ...(voicesLoaded ? families : family === ALL ? [] : [family]).map((id) => [id, label(`family_${id}`)]),
    ];
    const genderOptions = [[ALL, label('gender_all')], ...genders.map((value) => [value, genderLabel(value)])];
    const voiceOptions = [
        [DEFAULT_VOICE, label('use_default_voice')],
        ...voiceItems.map((voice) => [
            voice.name,
            voice.gender ? `${voice.name} · ${genderLabel(voice.gender)}` : voice.name,
        ]),
    ];

    return (
        <ConfigForm>
            <Toaster />
            <InstanceNameField
                value={config[INSTANCE_NAME_CONFIG_KEY] ?? ''}
                onChange={(value) => setValue(INSTANCE_NAME_CONFIG_KEY, value)}
            />
            <SettingInput
                required
                label={label('credential')}
                hint={label('credential_hint')}
                value={config.credential}
                secret
                onValueChange={(value) => setValue('credential', value)}
            />
            <SettingSelect
                label={label('auth_type')}
                value={config.authType}
                options={AUTH_OPTIONS.map(([key, labelKey]) => [key, label(labelKey)])}
                onChange={(value) => setValue('authType', value)}
            />
            <SettingInput
                label={label('request_path')}
                hint={label('request_path_hint')}
                value={config.requestPath}
                onValueChange={(value) => {
                    setVoices(null);
                    setValue('requestPath', value);
                }}
            />
            <SettingSelect
                label={label('default_voice')}
                hint={label('default_voice_hint')}
                value={config.voice}
                options={Object.entries(VoiceOptions)}
                onChange={(value) => setValue('voice', value)}
            />

            <div className='flex flex-col gap-1 pt-2'>
                <h3 className='text-sm font-medium leading-none'>{label('voice_by_language')}</h3>
                <ConfigNote>{label('voice_by_language_hint')}</ConfigNote>
            </div>
            <Button
                type='button'
                variant='outline'
                className='w-full'
                disabled={isLoadingVoices || isTesting}
                onClick={() => void loadVoices()}
            >
                {isLoadingVoices && <Spinner />}
                {label('load_voices')}
            </Button>
            {!voicesLoaded && <ConfigNote>{label('load_voices_hint')}</ConfigNote>}
            <SettingSelect
                label={label('language')}
                value={selectedLanguage}
                options={languageOptions}
                onChange={changeLanguage}
            />
            {(!voicesLoaded || regions.length > 1) && (
                <SettingSelect
                    label={label('region')}
                    value={region}
                    options={regionOptions}
                    isDisabled={!voicesLoaded}
                    onChange={(value) => setFilters({ region: value, family: ALL, gender: ALL })}
                />
            )}
            <SettingSelect
                label={label('family')}
                value={family}
                options={familyOptions}
                isDisabled={!voicesLoaded}
                onChange={(value) => setFilters({ region, family: value, gender: ALL })}
            />
            <SettingSelect
                label={label('gender')}
                value={gender}
                options={genderOptions}
                isDisabled={!voicesLoaded}
                onChange={(value) => setFilters({ region, family, gender: value })}
            />
            <SettingSelect
                label={label('voice')}
                value={savedVoice || DEFAULT_VOICE}
                options={voiceOptions}
                onChange={changeVoice}
            />

            <SettingSelect
                label={label('audio_encoding')}
                value={config.audioEncoding}
                options={AUDIO_OPTIONS.map((value) => [value, value])}
                onChange={(value) => setValue('audioEncoding', value)}
            />
            <SettingSelect
                label={label('speaking_rate')}
                value={config.speakingRate}
                options={SPEAKING_RATE_OPTIONS.map((value) => [value, `${value}×`])}
                onChange={(value) => setValue('speakingRate', value)}
            />
            <SettingInput
                label={label('pitch')}
                value={config.pitch}
                type='number'
                onValueChange={(value) => setValue('pitch', value)}
            />
            <SettingInput
                label={label('volume_gain_db')}
                value={config.volumeGainDb}
                type='number'
                onValueChange={(value) => setValue('volumeGainDb', value)}
            />
            <SettingInput
                label={label('sample_rate_hertz')}
                value={config.sampleRateHertz}
                type='number'
                onValueChange={(value) => setValue('sampleRateHertz', value)}
            />
            <SettingInput
                label={label('effects_profile_id')}
                value={config.effectsProfileId}
                onValueChange={(value) => setValue('effectsProfileId', value)}
            />
            <ConfigNote>{label('audio_controls_hint')}</ConfigNote>
            <ConfigNote>{label('billing_hint')}</ConfigNote>
            <ConfigNote>{label('long_text_hint')}</ConfigNote>
            <ConfigFooter
                onCancel={onClose}
                onSave={saveConfig}
            >
                <Button
                    type='button'
                    variant='outline'
                    disabled={isTesting || isLoadingVoices}
                    onClick={() => void testVoice()}
                >
                    {isTesting && <Spinner />}
                    {label('test')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
