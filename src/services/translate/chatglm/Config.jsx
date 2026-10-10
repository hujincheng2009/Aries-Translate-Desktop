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
    InstanceNameField,
    SecretInput,
} from '@/components/app/ServiceConfigForm';
import OptionSelect from '@/components/app/OptionSelect';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { translate } from './index';
import { Language } from './index';

// https://open.bigmodel.cn/dev/api/normal-model/glm-4
const availableModels = 'glm-4-plus、glm-4-0520、glm-4 、glm-4-air、glm-4-airx、glm-4-long 、 glm-4-flash'
    .split('、')
    .map((it) => it.trim());

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [serviceConfig, setServiceConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.chatglm.title'),
            model: 'chatglm_turbo',
            apiKey: '',
            promptList: [
                {
                    role: 'user',
                    content:
                        'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                },
                { role: 'assistant', content: 'Ok, I will only translate the text content, never interpret it.' },
                { role: 'user', content: `Translate into Chinese\n"""\nhello\n"""` },
                { role: 'assistant', content: '你好' },
                { role: 'user', content: `Translate into $to\n"""\n$text\n"""` },
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

                <ConfigField
                    fieldKey='model'
                    label={t('services.translate.chatglm.model')}
                >
                    <OptionSelect
                        className='w-full'
                        value={serviceConfig.model}
                        label={serviceConfig.model}
                        options={availableModels.map((it) => ({ value: it, label: it }))}
                        onChange={(key) => {
                            setServiceConfig({
                                ...serviceConfig,
                                model: key,
                            });
                        }}
                    />
                </ConfigField>
                <ConfigField
                    fieldKey='apiKey'
                    label={t('services.translate.chatglm.api_key')}
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
                    description={t('services.translate.chatglm.prompt_description')}
                    prompts={(serviceConfig.promptList ?? []).map((prompt) => ({
                        role: prompt.role,
                        text: prompt.content,
                    }))}
                    onChange={(index, value) => {
                        setServiceConfig({
                            ...serviceConfig,
                            promptList: serviceConfig.promptList.map((p, i) => {
                                if (i === index) {
                                    return {
                                        role: index % 2 !== 0 ? 'assistant' : 'user',
                                        content: value,
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
                                    role: serviceConfig.promptList.length % 2 === 0 ? 'user' : 'assistant',
                                    content: '',
                                },
                            ],
                        });
                    }}
                    addLabel={t('services.translate.chatglm.add')}
                />
                <ConfigFooter
                    onCancel={onClose}
                    isLoading={isLoading}
                />
            </ConfigForm>
        )
    );
}
