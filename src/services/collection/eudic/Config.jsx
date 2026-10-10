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
import { useConfig } from '../../../hooks';
import { useToastStyle } from '../../../hooks';
import { collection } from './index';

export function Config(props) {
    const [isLoading, setIsLoading] = useState(false);
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.collection.eudic.title'),
            name: 'pot',
            token: '',
        },
        { sync: false }
    );
    const reportError = useServiceError(config);

    const toastStyle = useToastStyle();

    return (
        config !== null && (
            <>
                <Toaster />
                <ConfigForm
                    onSubmit={(e) => {
                        e.preventDefault();
                        setIsLoading(true);
                        collection('test', '测试', { config }).then(
                            () => {
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
                        fieldKey='name'
                        label={t('services.collection.eudic.name')}
                    >
                        <Input
                            value={config['name'] ?? ''}
                            onChange={(e) => {
                                setConfig({
                                    ...config,
                                    name: e.target.value,
                                });
                            }}
                        />
                    </ConfigField>
                    <ConfigField
                        fieldKey='token'
                        label={t('services.collection.eudic.token')}
                    >
                        <SecretInput
                            value={config['token'] ?? ''}
                            onChange={(e) => {
                                setConfig({
                                    ...config,
                                    token: e.target.value,
                                });
                            }}
                        />
                    </ConfigField>
                    <ConfigFooter
                        onCancel={onClose}
                        isLoading={isLoading}
                    />
                </ConfigForm>
            </>
        )
    );
}
