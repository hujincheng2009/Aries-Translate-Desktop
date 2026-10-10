import { useServiceError } from '@/hooks/useServiceError';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { ConfigField, ConfigFooter, ConfigForm, InstanceNameField } from '@/components/app/ServiceConfigForm';
import { Input } from '@/components/ui/input';
import { useConfig } from '../../../hooks';
import { useToastStyle } from '../../../hooks';
import { collection } from './index';

export function Config(props) {
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();
    const { instanceKey, updateServiceList, onClose } = props;
    const [ankiConfig, setAnkiConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.collection.anki.title'),
            port: 8765,
        },
        { sync: false }
    );
    const reportError = useServiceError(ankiConfig);

    const toastStyle = useToastStyle();

    return (
        ankiConfig !== null && (
            <>
                <Toaster />
                <ConfigForm
                    onSubmit={(e) => {
                        e.preventDefault();
                        setIsLoading(true);
                        collection('test', '测试', { config: ankiConfig }).then(
                            () => {
                                setIsLoading(false);
                                setAnkiConfig(ankiConfig, true);
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
                        value={ankiConfig[INSTANCE_NAME_CONFIG_KEY]}
                        onChange={(value) => {
                            setAnkiConfig({
                                ...ankiConfig,
                                [INSTANCE_NAME_CONFIG_KEY]: value,
                            });
                        }}
                    />

                    <ConfigField
                        fieldKey='port'
                        label={t('services.collection.anki.port')}
                    >
                        <Input
                            type='number'
                            value={ankiConfig['port'] ?? ''}
                            onChange={(e) => {
                                setAnkiConfig({
                                    ...ankiConfig,
                                    port: e.target.value,
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
