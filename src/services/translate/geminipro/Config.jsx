import { useServiceError } from '@/hooks/useServiceError';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import {
    ConfigField,
    ConfigFooter,
    ConfigForm,
    ConfigPromptList,
    ConfigSwitchRow,
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
    const [serviceConfig, setServiceConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.geminipro.title'),
            stream: true,
            apiKey: '',
            requestPath: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro',
            promptList: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: 'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                        },
                    ],
                },
                {
                    role: 'model',
                    parts: [
                        {
                            text: 'Ok, I will only translate the text content, never interpret it.',
                        },
                    ],
                },
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Translate into Chinese\n"""\nhello\n"""`,
                        },
                    ],
                },
                {
                    role: 'model',
                    parts: [
                        {
                            text: '你好',
                        },
                    ],
                },
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Translate into $to\n"""\n$text\n"""`,
                        },
                    ],
                },
            ],
        },
        { sync: false }
    );
    const reportError = useServiceError(serviceConfig);
    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();

    return (
        serviceConfig !== null && (
            <ConfigForm
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    translate('hello', Language.auto, Language.zh_cn, { config: serviceConfig }).then(
                        () => {
                            setIsLoading(false);
                            setServiceConfig(serviceConfig, true);
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
                    value={serviceConfig[INSTANCE_NAME_CONFIG_KEY]}
                    onChange={(value) => {
                        setServiceConfig({
                            ...serviceConfig,
                            [INSTANCE_NAME_CONFIG_KEY]: value,
                        });
                    }}
                />

                <ConfigSwitchRow
                    label={t('services.translate.geminipro.stream')}
                    checked={serviceConfig['stream'] ?? false}
                    onCheckedChange={(value) => {
                        setServiceConfig({
                            ...serviceConfig,
                            stream: value,
                        });
                    }}
                />
                <ConfigField
                    fieldKey='requestPath'
                    label={t('services.translate.geminipro.request_path')}
                >
                    <Input
                        value={serviceConfig['requestPath'] ?? ''}
                        onChange={(e) => {
                            setServiceConfig({
                                ...serviceConfig,
                                requestPath: e.target.value,
                            });
                        }}
                    />
                </ConfigField>
                <ConfigField
                    fieldKey='apiKey'
                    label={t('services.translate.geminipro.api_key')}
                >
                    <SecretInput
                        value={serviceConfig['apiKey'] ?? ''}
                        onChange={(e) => {
                            setServiceConfig({
                                ...serviceConfig,
                                apiKey: e.target.value,
                            });
                        }}
                    />
                </ConfigField>
                <ConfigPromptList
                    description={t('services.translate.geminipro.prompt_description')}
                    prompts={(serviceConfig.promptList ?? []).map((prompt) => ({
                        role: prompt.role,
                        text: prompt.parts[0].text,
                    }))}
                    onChange={(index, value) => {
                        setServiceConfig({
                            ...serviceConfig,
                            promptList: serviceConfig.promptList.map((p, i) => {
                                if (i === index) {
                                    return {
                                        role: index % 2 !== 0 ? 'model' : 'user',
                                        parts: [
                                            {
                                                text: value,
                                            },
                                        ],
                                    };
                                } else {
                                    return p;
                                }
                            }),
                        });
                    }}
                    onDelete={(index) => {
                        setServiceConfig({
                            ...serviceConfig,
                            promptList: serviceConfig.promptList.filter((p, i) => i !== index),
                        });
                    }}
                    onAdd={() => {
                        setServiceConfig({
                            ...serviceConfig,
                            promptList: [
                                ...serviceConfig.promptList,
                                {
                                    role: serviceConfig.promptList.length % 2 === 0 ? 'user' : 'model',
                                    parts: [
                                        {
                                            text: '',
                                        },
                                    ],
                                },
                            ],
                        });
                    }}
                    addLabel={t('services.translate.geminipro.add')}
                />
                <ConfigFooter
                    onCancel={onClose}
                    isLoading={isLoading}
                />
            </ConfigForm>
        )
    );
}
