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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';
import { useToastStyle } from '../../../hooks';
import { useConfig } from '../../../hooks/useConfig';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Language } from './info';
import { translate, validateAzureTranslateConfig } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [isTesting, setIsTesting] = useState(false);
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.azure_translate.title'),
            key: '',
            region: '',
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
            validateAzureTranslateConfig(config);
            const result = await translate('Hello', Language.en, Language.zh_cn, { config });
            toast.success(`${t('services.translate.azure_translate.test_success')} ${result}`, { style: toastStyle });
        } catch (error) {
            showError(error);
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = () => {
        try {
            validateAzureTranslateConfig(config);
            setConfig(config, true);
            updateServiceList(instanceKey);
            onClose();
        } catch (error) {
            showError(error);
        }
    };

    if (config === null) return null;

    return (
        <ConfigForm>
            <Toaster />
            <InstanceNameField
                value={config[INSTANCE_NAME_CONFIG_KEY]}
                onChange={(value) => setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value })}
            />
            <ConfigField
                fieldKey='key'
                label={t('services.translate.azure_translate.key')}
                hint={t('services.translate.azure_translate.key_hint')}
            >
                <SecretInput
                    value={config.key ?? ''}
                    onChange={(e) => setConfig({ ...config, key: e.target.value })}
                />
            </ConfigField>
            <ConfigField
                fieldKey='region'
                label={t('services.translate.azure_translate.region')}
                hint={t('services.translate.azure_translate.region_hint')}
            >
                <Input
                    value={config.region ?? ''}
                    placeholder='westeurope'
                    onChange={(e) => setConfig({ ...config, region: e.target.value })}
                />
            </ConfigField>
            <ConfigNote>{t('services.translate.azure_translate.billing_hint')}</ConfigNote>
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
                    {t('services.translate.azure_translate.test')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
