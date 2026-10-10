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
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { playVoice } from '../../../hooks/useVoice';
import { resolveAzureSettingsLocale, supportsAzureLocale } from './core';
import { getAzureVoices, Language, tts, validateAzureConfig } from './index';

const AUTO_VOICE = 'auto';
const TEST_TEXT = {
    'en-US': 'Hello from Aries.',
    'zh-CN': 'Aries 语音测试。',
    'zh-TW': 'Aries 語音測試。',
    'ja-JP': 'Aries の音声テストです。',
    'ko-KR': 'Aries 음성 테스트입니다.',
    'fr-FR': 'Test vocal Aries.',
    'es-ES': 'Prueba de voz de Aries.',
    'ru-RU': 'Проверка речи Aries.',
    'de-DE': 'Aries Sprachtest.',
    'it-IT': 'Test vocale di Aries.',
    'tr-TR': 'Aries ses testi.',
    'pt-PT': 'Teste de voz do Aries.',
    'pt-BR': 'Teste de voz do Aries.',
    'vi-VN': 'Bài kiểm tra giọng nói Aries.',
    'id-ID': 'Tes suara Aries.',
    'th-TH': 'ทดสอบเสียง Aries',
    'ms-MY': 'Ujian suara Aries.',
    'ar-AE': 'اختبار صوت Aries',
    'hi-IN': 'Aries आवाज़ परीक्षण।',
    'mn-MN': 'Aries-ийн дуу хоолойн шалгалт.',
    'km-KH': 'ការសាកល្បងសំឡេង Aries',
    'nb-NO': 'Aries stemmetest.',
    'nn-NO': 'Aries stemmetest.',
    'fa-IR': 'آزمایش صدای Aries',
    'sv-SE': 'Rösttest för Aries.',
    'pl-PL': 'Test syntezy mowy w Aries.',
    'nl-NL': 'Aries-stemtest.',
    'uk-UA': 'Перевірка голосу Aries.',
    'he-IL': 'בדיקת קול של Aries.',
};

const languageOptions = Object.entries(Language).filter(([key]) => key !== 'auto');
const languageLocales = languageOptions.map(([, locale]) => locale);

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [voices, setVoices] = useState([]);
    const [azureConfig, setAzureConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.azure_tts.title'),
            key: '',
            region: '',
            endpoint: '',
            voiceOverrides: {},
        },
        { sync: false }
    );
    const reportError = useServiceError(azureConfig);
    const selectedLanguage = resolveAzureSettingsLocale(azureConfig, languageLocales, Language.en);

    const showError = (error) => {
        reportError(error);
    };

    const changeRegion = (value) => {
        setVoices([]);
        setAzureConfig({ ...azureConfig, region: value });
    };

    const changeEndpoint = (value) => {
        setVoices([]);
        setAzureConfig({ ...azureConfig, endpoint: value });
    };

    const refreshVoices = async () => {
        setIsLoadingVoices(true);
        try {
            const voiceList = await getAzureVoices(azureConfig, { refresh: true });
            setVoices(voiceList);
            toast.success(t('services.tts.azure_tts.voices_loaded'), { style: toastStyle });
        } catch (error) {
            showError(error);
        } finally {
            setIsLoadingVoices(false);
        }
    };

    const changeVoice = (value) => {
        if (!value) return;

        const voiceOverrides = { ...(azureConfig.voiceOverrides ?? {}) };
        if (value === AUTO_VOICE) {
            delete voiceOverrides[selectedLanguage];
        } else {
            voiceOverrides[selectedLanguage] = value;
        }
        setAzureConfig({ ...azureConfig, voiceOverrides });
    };

    const testVoice = async () => {
        setIsTesting(true);
        try {
            validateAzureConfig(azureConfig);
            const text = TEST_TEXT[selectedLanguage] ?? 'Hello from Aries.';
            const audio = await tts(text, selectedLanguage, { config: azureConfig });
            await playVoice(audio);
        } catch (error) {
            showError(error);
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = () => {
        try {
            validateAzureConfig(azureConfig);
            setAzureConfig(azureConfig, true);
            updateServiceList(instanceKey);
            onClose();
        } catch (error) {
            showError(error);
        }
    };

    if (azureConfig === null) return null;

    const selectedLocaleVoices = voices.filter((voice) => supportsAzureLocale(voice, selectedLanguage));
    const selectedVoice = azureConfig.voiceOverrides?.[selectedLanguage] ?? AUTO_VOICE;
    const isSavedVoiceUnlisted =
        selectedVoice !== AUTO_VOICE && !selectedLocaleVoices.some((voice) => voice.ShortName === selectedVoice);
    const voiceOptions = [
        [AUTO_VOICE, t('services.tts.azure_tts.automatic_voice')],
        ...(isSavedVoiceUnlisted ? [[selectedVoice, selectedVoice]] : []),
        ...selectedLocaleVoices.map((voice) => [
            voice.ShortName,
            `${voice.LocaleName ?? voice.Locale} · ${voice.LocalName ?? voice.ShortName} · ${voice.Gender ?? ''}`,
        ]),
    ];

    const selectedVoiceLabel = voiceOptions.find(([key]) => key === selectedVoice)?.[1];

    return (
        <ConfigForm>
            <Toaster />
            <InstanceNameField
                value={azureConfig[INSTANCE_NAME_CONFIG_KEY] ?? ''}
                onChange={(value) => setAzureConfig({ ...azureConfig, [INSTANCE_NAME_CONFIG_KEY]: value })}
            />
            <ConfigField
                fieldKey='key'
                label={t('services.tts.azure_tts.key')}
                hint={t('services.tts.azure_tts.key_hint')}
            >
                <SecretInput
                    value={azureConfig.key ?? ''}
                    onChange={(e) => setAzureConfig({ ...azureConfig, key: e.target.value })}
                />
            </ConfigField>
            <ConfigField
                fieldKey='region'
                label={t('services.tts.azure_tts.region')}
            >
                <Input
                    value={azureConfig.region ?? ''}
                    placeholder='westeurope'
                    onChange={(e) => changeRegion(e.target.value)}
                />
            </ConfigField>
            <ConfigField
                fieldKey='endpoint'
                label={t('services.tts.azure_tts.endpoint')}
                hint={t('services.tts.azure_tts.endpoint_hint')}
            >
                <Input
                    value={azureConfig.endpoint ?? ''}
                    placeholder='https://resource.cognitiveservices.azure.com'
                    onChange={(e) => changeEndpoint(e.target.value)}
                />
            </ConfigField>
            <ConfigField label={t('services.tts.azure_tts.language')}>
                <OptionSelect
                    className='w-full'
                    value={selectedLanguage}
                    label={`${selectedLanguage} (${languageOptions.find(([, locale]) => locale === selectedLanguage)?.[0] ?? ''})`}
                    options={languageOptions.map(([key, locale]) => ({ value: locale, label: `${locale} (${key})` }))}
                    onChange={(value) => {
                        if (value) setAzureConfig({ ...azureConfig, settingsLocale: value });
                    }}
                />
            </ConfigField>
            <ConfigField label={t('services.tts.azure_tts.voice')}>
                <OptionSelect
                    className='w-full'
                    value={selectedVoice}
                    label={selectedVoiceLabel}
                    options={voiceOptions.map(([value, label]) => ({ value, label }))}
                    onChange={changeVoice}
                />
            </ConfigField>
            <Button
                type='button'
                variant='outline'
                className='w-full'
                disabled={isLoadingVoices || isTesting}
                onClick={() => void refreshVoices()}
            >
                {isLoadingVoices && <Spinner />}
                {t('services.tts.azure_tts.load_voices')}
            </Button>
            <ConfigNote>{t('services.tts.azure_tts.billing_hint')}</ConfigNote>
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
                    {t('services.tts.azure_tts.test')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
