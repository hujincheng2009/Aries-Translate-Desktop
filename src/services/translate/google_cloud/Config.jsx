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
import { Spinner } from '@/components/ui/misc';
import { useToastStyle } from '../../../hooks';
import { useConfig } from '../../../hooks/useConfig';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { Language } from './info';
import { translate, validateGoogleCloudTranslateConfig } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [isTesting, setIsTesting] = useState(false);
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.google_cloud_translate.title'),
            apiKey: '',
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
            validateGoogleCloudTranslateConfig(config);
            const result = await translate('Hello', Language.en, Language.zh_cn, { config });
            toast.success(`${t('services.translate.google_cloud_translate.test_success')} ${result}`, {
                style: toastStyle,
            });
        } catch (error) {
            showError(error);
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = () => {
        try {
            validateGoogleCloudTranslateConfig(config);
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
                fieldKey='apiKey'
                label={t('services.translate.google_cloud_translate.api_key')}
                hint={t('services.translate.google_cloud_translate.api_key_hint')}
            >
                <SecretInput
                    value={config.apiKey ?? ''}
                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                />
            </ConfigField>
            <ConfigNote>{t('services.translate.google_cloud_translate.billing_hint')}</ConfigNote>
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
                    {t('services.translate.google_cloud_translate.test')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
