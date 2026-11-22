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
import { OPENROUTER_DEFAULT_FORMATS } from './core';
import { Language } from './info';
import { fetchOpenRouterSpeechModel, tts, validateOpenRouterConfig } from './index';

const SPEED_OPTIONS = [
    ['1', '1.0×'],
    ['0.5', '0.5×'],
    ['0.75', '0.75×'],
    ['1.25', '1.25×'],
    ['1.5', '1.5×'],
    ['2', '2.0×'],
];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [isTesting, setIsTesting] = useState(false);
    const [isFetchingVoices, setIsFetchingVoices] = useState(false);
    const [speechModel, setSpeechModel] = useState(null);
    const [config, setConfig, getConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.openrouter_tts.title'),
            apiKey: '',
            model: '',
            voice: '',
            speed: '1',
        },
        { sync: false }
    );
    const reportError = useServiceError(config);

    const showError = (error) => {
        reportError(error);
    };

    const fetchVoices = async () => {
        const model = config.model.trim();
        setIsFetchingVoices(true);
        try {
            const capabilities = await fetchOpenRouterSpeechModel(model);
            if (getConfig()?.model?.trim() === model) setSpeechModel({ model, ...capabilities });
        } catch (error) {
            if (getConfig()?.model?.trim() === model) showError(error);
        } finally {
            setIsFetchingVoices(false);
        }
    };

    const testVoice = async () => {
        setIsTesting(true);
        try {
            validateOpenRouterConfig(config);
            const audio = await tts('Hello from Aries. This is a short speech test.', Language.auto, { config });
            await playVoice(audio);
            toast.success(t('services.tts.openrouter_tts.test_success'), { style: toastStyle });
        } catch (error) {
            showError(error);
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = () => {
        try {
            validateOpenRouterConfig(config);
            setConfig(config, true);
            updateServiceList(instanceKey);
            onClose();
        } catch (error) {
            showError(error);
        }
    };

    if (config === null) return null;

    const speed = String(config.speed ?? '1');
    const model = config.model?.trim() ?? '';
    const currentSpeechModel = speechModel?.model === model ? speechModel : null;
    const voices = currentSpeechModel?.voices ?? [];
    const selectedVoice = voices.includes(config.voice) ? config.voice : '';
    const publishedFormats = currentSpeechModel?.formats ?? [];
    const responseFormat = config.responseFormat ?? '';
    const formats = [...new Set([...OPENROUTER_DEFAULT_FORMATS, ...publishedFormats])];
    if (responseFormat === 'mp4' && !formats.includes('mp4')) formats.push('mp4');

    return (
        <ConfigForm>
            <Toaster />
            <InstanceNameField
                value={config[INSTANCE_NAME_CONFIG_KEY] ?? ''}
                onChange={(value) => setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value })}
            />
            <ConfigField
                fieldKey='apiKey'
                label={t('services.tts.openrouter_tts.api_key')}
                hint={t('services.tts.openrouter_tts.api_key_hint')}
            >
                <SecretInput
                    value={config.apiKey ?? ''}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                />
            </ConfigField>
            <ConfigField
                fieldKey='model'
                label={t('services.tts.openrouter_tts.model')}
            >
                <Input
                    value={config.model ?? ''}
                    placeholder='provider/model-id'
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                />
            </ConfigField>
            <ConfigField
                fieldKey='voice'
                label={t('services.tts.openrouter_tts.voice')}
                hint={t('services.tts.openrouter_tts.voice_hint')}
            >
                {({ id, describedBy }) => (
                    <div className='flex flex-col gap-2'>
                        <div className='flex gap-2'>
                            <Input
                                id={id}
                                aria-describedby={describedBy}
                                className='min-w-0 flex-1'
                                value={config.voice ?? ''}
                                placeholder={t('services.tts.openrouter_tts.voice_placeholder')}
                                onChange={(e) => setConfig({ ...config, voice: e.target.value })}
                            />
                            <Button
                                type='button'
                                variant='outline'
                                disabled={!model || isFetchingVoices}
                                onClick={() => void fetchVoices()}
                            >
                                {isFetchingVoices && <Spinner />}
                                {t('services.tts.openrouter_tts.fetch_voices')}
                            </Button>
                        </div>
                        {voices.length > 0 && (
                            <OptionSelect
                                className='w-full'
                                ariaLabel={t('services.tts.openrouter_tts.select_voice')}
                                value={selectedVoice}
                                label={selectedVoice}
                                placeholder={t('services.tts.openrouter_tts.select_voice')}
                                options={voices.map((voice) => ({ value: voice, label: voice }))}
                                onChange={(voice) => setConfig({ ...config, voice })}
                            />
                        )}
                        {currentSpeechModel && voices.length === 0 && (
                            <span
                                role='status'
                                className='text-sm text-muted-foreground'
                            >
                                {t('services.tts.openrouter_tts.no_voices')}
                            </span>
                        )}
                    </div>
                )}
            </ConfigField>
            <ConfigField
                label={t('services.tts.openrouter_tts.audio_format')}
                hint={
                    publishedFormats.length
                        ? t('services.tts.openrouter_tts.audio_format_available', {
                              formats: publishedFormats.map((format) => format.toUpperCase()).join(' / '),
                          })
                        : t('services.tts.openrouter_tts.audio_format_hint')
                }
            >
                <OptionSelect
                    className='w-full'
                    value={responseFormat || 'auto'}
                    label={responseFormat.toUpperCase() || t('services.tts.openrouter_tts.audio_format_auto')}
                    options={[
                        { value: 'auto', label: t('services.tts.openrouter_tts.audio_format_auto') },
                        ...formats.map((format) => ({ value: format, label: format.toUpperCase() })),
                    ]}
                    onChange={(value) => setConfig({ ...config, responseFormat: value === 'auto' ? '' : value })}
                />
            </ConfigField>
            <ConfigField label={t('services.tts.openrouter_tts.speed')}>
                <OptionSelect
                    className='w-full'
                    value={speed}
                    label={SPEED_OPTIONS.find(([value]) => value === speed)?.[1]}
                    options={SPEED_OPTIONS.map(([value, label]) => ({ value, label }))}
                    onChange={(value) => {
                        if (value) setConfig({ ...config, speed: value });
                    }}
                />
            </ConfigField>
            <ConfigNote>{t('services.tts.openrouter_tts.billing_hint')}</ConfigNote>
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
                    {t('services.tts.openrouter_tts.test')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
