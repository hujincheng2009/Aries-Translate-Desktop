import { useServiceError } from '@/hooks/useServiceError';
import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
import { DEFAULT_GEMINI_TTS_MODEL, GEMINI_TTS_VOICES, redactGeminiTtsError } from './core';
import { Language } from './info';
import { tts, validateGeminiTtsConfig } from './index';

const CUSTOM_VOICE = '__custom__';
const label = (key) => `services.tts.gemini_tts.${key}`;

export function Config({ instanceKey, updateServiceList, onClose }) {
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [isTesting, setIsTesting] = useState(false);
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t(label('title')),
            apiKey: '',
            model: DEFAULT_GEMINI_TTS_MODEL,
            voice: 'Kore',
            style: '',
        },
        { sync: false }
    );
    const reportError = useServiceError(config);

    if (config === null) return null;

    const voice = (config.voice ?? '').trim() || 'Kore';
    const selectedVoice = GEMINI_TTS_VOICES.includes(voice) ? voice : CUSTOM_VOICE;
    const showError = (error) => reportError(error);

    const testVoice = async () => {
        setIsTesting(true);
        try {
            validateGeminiTtsConfig(config);
            const audio = await tts('Hello from Aries. This is a short speech test.', Language.auto, { config });
            await playVoice(audio);
            toast.success(t(label('test_success')), { style: toastStyle });
        } catch (error) {
            showError(error);
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = () => {
        try {
            validateGeminiTtsConfig(config);
            setConfig(config, true);
            updateServiceList(instanceKey);
            onClose();
        } catch (error) {
            showError(error);
        }
    };

    return (
        <ConfigForm>
            <Toaster />
            <InstanceNameField
                value={config[INSTANCE_NAME_CONFIG_KEY] ?? ''}
                onChange={(value) => setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value })}
            />
            <ConfigField
                fieldKey='apiKey'
                label={t(label('api_key'))}
                hint={t(label('api_key_hint'))}
            >
                <SecretInput
                    value={config.apiKey ?? ''}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                />
            </ConfigField>
            <ConfigField
                fieldKey='model'
                label={t(label('model'))}
                hint={t(label('model_hint'))}
            >
                <Input
                    value={config.model ?? ''}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                />
            </ConfigField>
            <ConfigField label={t(label('voice'))}>
                <OptionSelect
                    className='w-full'
                    value={selectedVoice}
                    label={selectedVoice === CUSTOM_VOICE ? t(label('custom_voice')) : selectedVoice}
                    options={[...GEMINI_TTS_VOICES, CUSTOM_VOICE].map((value) => ({
                        value,
                        label: value === CUSTOM_VOICE ? t(label('custom_voice')) : value,
                    }))}
                    onChange={(value) => {
                        if (!value) return;
                        setConfig({ ...config, voice: value === CUSTOM_VOICE ? 'voice_' : value });
                    }}
                />
            </ConfigField>
            {selectedVoice === CUSTOM_VOICE && (
                <ConfigField
                    fieldKey='voice'
                    label={t(label('custom_voice'))}
                >
                    <Input
                        value={config.voice ?? ''}
                        placeholder='voice_...'
                        onChange={(e) => setConfig({ ...config, voice: e.target.value })}
                    />
                </ConfigField>
            )}
            <ConfigField
                fieldKey='style'
                label={t(label('style'))}
                hint={t(label('style_hint'))}
            >
                <Input
                    value={config.style ?? ''}
                    placeholder='calm, clear narration'
                    onChange={(e) => setConfig({ ...config, style: e.target.value })}
                />
            </ConfigField>
            <ConfigNote>{t(label('billing_hint'))}</ConfigNote>
            <ConfigFooter
                onCancel={onClose}
                onSave={saveConfig}
            >
                <Button
                    type='button'
                    variant='outline'
                    disabled={isTesting}
                    onClick={() => void testVoice()}
                >
                    {isTesting && <Spinner />}
                    {t(label('test'))}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
