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
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { AZURE_OCR_CHECK_IMAGE_BASE64 } from './check_image';
import { AZURE_OCR_ENGINES } from './core';
import { Language } from './info';
import { recognize, validateAzureOcrConfig } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const label = (key) => t(`services.recognize.azure_ocr.${key}`);
    const toastStyle = useToastStyle();
    const [isTesting, setIsTesting] = useState(false);
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.azure_ocr.title'),
            engine: AZURE_OCR_ENGINES[0],
            endpoint: '',
            key: '',
        },
        { sync: false }
    );
    const reportError = useServiceError(config);

    const showError = (error) => {
        reportError(error);
    };

    const testConnection = async () => {
        setIsTesting(true);
        try {
            validateAzureOcrConfig(config);
            const result = await recognize(AZURE_OCR_CHECK_IMAGE_BASE64, Language.en, { config });
            toast.success(`${label('test_success')} ${result}`, { style: toastStyle });
        } catch (error) {
            showError(error);
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = () => {
        try {
            validateAzureOcrConfig(config);
            setConfig(config, true);
            updateServiceList(instanceKey);
            onClose();
        } catch (error) {
            showError(error);
        }
    };

    if (config === null) return null;

    const engine = config.engine || AZURE_OCR_ENGINES[0];

    return (
        <ConfigForm>
            <Toaster />
            <InstanceNameField
                value={config[INSTANCE_NAME_CONFIG_KEY] ?? ''}
                onChange={(value) => setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value })}
            />
            <ConfigField
                label={label('engine')}
                hint={label(`engine_${engine}_hint`)}
            >
                <OptionSelect
                    className='w-full'
                    value={engine}
                    label={label(`engine_${engine}`)}
                    options={AZURE_OCR_ENGINES.map((value) => ({
                        value,
                        label: label(`engine_${value}`),
                    }))}
                    onChange={(value) => {
                        if (value) setConfig({ ...config, engine: value });
                    }}
                />
            </ConfigField>
            <ConfigField
                fieldKey='endpoint'
                label={label('endpoint')}
            >
                <Input
                    value={config.endpoint ?? ''}
                    placeholder='https://<name>.cognitiveservices.azure.com'
                    onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                />
            </ConfigField>
            <ConfigField
                fieldKey='key'
                label={label('key')}
                hint={label('endpoint_hint')}
            >
                <SecretInput
                    value={config.key ?? ''}
                    onChange={(e) => setConfig({ ...config, key: e.target.value })}
                />
            </ConfigField>
            <ConfigNote>{label('billing_hint')}</ConfigNote>
            <ConfigFooter
                onCancel={onClose}
                onSave={saveConfig}
            >
                <Button
                    type='button'
                    variant='outline'
                    disabled={isTesting}
                    onClick={() => void testConnection()}
                >
                    {isTesting && <Spinner />}
                    {label('test')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
