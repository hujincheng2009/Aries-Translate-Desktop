import { useServiceError } from '@/hooks/useServiceError';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import {
    ConfigField,
    ConfigFooter,
    ConfigForm,
    ConfigGuide,
    InstanceNameField,
    SecretInput,
} from '@/components/app/ServiceConfigForm';
import OptionSelect from '@/components/app/OptionSelect';
import { Input } from '@/components/ui/input';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { translate } from './index';
import { Language } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [deeplConfig, setDeeplConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.deepl.title'),
            type: 'free',
            authKey: '',
            customUrl: '',
        },
        { sync: false }
    );
    const reportError = useServiceError(deeplConfig);
    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();

    return (
        deeplConfig !== null && (
            <ConfigForm
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    translate('hello', Language.auto, Language.zh_cn, { config: deeplConfig }).then(
                        () => {
                            setIsLoading(false);
                            setDeeplConfig(deeplConfig, true);
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
                    value={deeplConfig[INSTANCE_NAME_CONFIG_KEY]}
                    onChange={(value) => {
                        setDeeplConfig({
                            ...deeplConfig,
                            [INSTANCE_NAME_CONFIG_KEY]: value,
                        });
                    }}
                />
                {deeplConfig.type === 'deeplx' && <ConfigGuide url='https://github.com/OwO-Network/DeepLX' />}
                <ConfigField
                    fieldKey='type'
                    label={t('services.translate.deepl.type')}
                >
                    <OptionSelect
                        className='w-full'
                        value={deeplConfig.type}
                        label={t(`services.translate.deepl.${deeplConfig.type}`)}
                        options={['free', 'api', 'deeplx'].map((key) => ({
                            value: key,
                            label: t(`services.translate.deepl.${key}`),
                        }))}
                        onChange={(key) => {
                            setDeeplConfig({
                                ...deeplConfig,
                                type: key,
                            });
                        }}
                    />
                </ConfigField>
                {deeplConfig.type === 'api' && (
                    <ConfigField
                        fieldKey='authKey'
                        label={t('services.translate.deepl.auth_key')}
                    >
                        <SecretInput
                            value={deeplConfig['authKey'] ?? ''}
                            onChange={(e) => {
                                setDeeplConfig({
                                    ...deeplConfig,
                                    authKey: e.target.value,
                                });
                            }}
                        />
                    </ConfigField>
                )}
                {deeplConfig.type === 'deeplx' && (
                    <ConfigField
                        fieldKey='customUrl'
                        label={t('services.translate.deepl.custom_url')}
                    >
                        <Input
                            value={deeplConfig.customUrl ?? ''}
                            onChange={(e) => {
                                setDeeplConfig({
                                    ...deeplConfig,
                                    customUrl: e.target.value,
                                });
                            }}
                        />
                    </ConfigField>
                )}
                <ConfigFooter
                    onCancel={onClose}
                    isLoading={isLoading}
                />
            </ConfigForm>
        )
    );
}
