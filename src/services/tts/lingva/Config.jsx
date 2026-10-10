import { useServiceError } from '@/hooks/useServiceError';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import { ConfigField, ConfigFooter, ConfigForm, InstanceNameField } from '@/components/app/ServiceConfigForm';
import { Input } from '@/components/ui/input';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { Language } from './index';
import { tts } from './index';

export function Config(props) {
    const [isLoading, setIsLoading] = useState(false);
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [lingvaConfig, setLingvaConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.lingva_tts.title'),
            requestPath: 'lingva.pot-app.com',
        },
        { sync: false }
    );
    const reportError = useServiceError(lingvaConfig);

    const toastStyle = useToastStyle();

    return (
        lingvaConfig !== null && (
            <>
                <Toaster />
                <ConfigForm>
                    <InstanceNameField
                        value={lingvaConfig[INSTANCE_NAME_CONFIG_KEY]}
                        onChange={(value) => {
                            setLingvaConfig({
                                ...lingvaConfig,
                                [INSTANCE_NAME_CONFIG_KEY]: value,
                            });
                        }}
                    />

                    <ConfigField
                        fieldKey='requestPath'
                        label={t('services.tts.lingva_tts.request_path')}
                    >
                        <Input
                            value={lingvaConfig['requestPath'] ?? ''}
                            onChange={(e) => {
                                setLingvaConfig({
                                    ...lingvaConfig,
                                    requestPath: e.target.value,
                                });
                            }}
                        />
                    </ConfigField>
                    <ConfigFooter
                        onCancel={onClose}
                        isLoading={isLoading}
                        onSave={() => {
                            setIsLoading(true);
                            tts('hello', Language.en, { config: lingvaConfig }).then(
                                () => {
                                    setIsLoading(false);
                                    setLingvaConfig(lingvaConfig, true);
                                    updateServiceList(instanceKey);
                                    onClose();
                                },
                                (e) => {
                                    setIsLoading(false);
                                    reportError(e);
                                }
                            );
                        }}
                    />
                </ConfigForm>
            </>
        )
    );
}
