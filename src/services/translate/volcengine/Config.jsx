import { useServiceError } from '@/hooks/useServiceError';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import {
    ConfigField,
    ConfigFooter,
    ConfigForm,
    InstanceNameField,
    SecretInput,
} from '@/components/app/ServiceConfigForm';
import { Input } from '@/components/ui/input';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { translate } from './index';
import { Language } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.volcengine.title'),
            appid: '',
            secret: '',
        },
        { sync: false }
    );
    const reportError = useServiceError(config);
    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();

    return (
        config !== null && (
            <ConfigForm
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    translate('hello', Language.auto, Language.zh_cn, { config }).then(
                        (v) => {
                            setIsLoading(false);
                            setConfig(config, true);
                            updateServiceList(instanceKey);
                            onClose();
                        },
                        (e) => {
                            setIsLoading(false);
                            reportError(e);
                        }
                    );
                }}
            >
                <Toaster />
                <InstanceNameField
                    value={config[INSTANCE_NAME_CONFIG_KEY]}
                    onChange={(value) => {
                        setConfig({
                            ...config,
                            [INSTANCE_NAME_CONFIG_KEY]: value,
                        });
                    }}
                />

                <ConfigField
                    fieldKey='appid'
                    label={t('services.translate.volcengine.appid')}
                >
                    <Input
                        value={config['appid'] ?? ''}
                        onChange={(e) => {
                            setConfig({
                                ...config,
                                appid: e.target.value,
                            });
                        }}
                    />
                </ConfigField>
                <ConfigField
                    fieldKey='secret'
                    label={t('services.translate.volcengine.secret')}
                >
                    <SecretInput
                        value={config['secret'] ?? ''}
                        onChange={(e) => {
                            setConfig({
                                ...config,
                                secret: e.target.value,
                            });
                        }}
                    />
                </ConfigField>
                <ConfigFooter
                    onCancel={onClose}
                    isLoading={isLoading}
                />
            </ConfigForm>
        )
    );
}
