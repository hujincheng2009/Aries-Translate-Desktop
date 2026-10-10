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
import { Language } from './info';
import { tts, validateOpenRouterConfig } from './index';

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
    const [config, setConfig] = useConfig(
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
                <Input
                    value={config.voice ?? ''}
                    placeholder={t('services.tts.openrouter_tts.voice_placeholder')}
                    onChange={(e) => setConfig({ ...config, voice: e.target.value })}
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
