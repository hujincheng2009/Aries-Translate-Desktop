import ServiceRecommendations from '@/components/app/ServiceRecommendations';
import { open } from '@tauri-apps/api/shell';
import { Button } from '@/components/ui/button';
import {
    buildReasoningArguments,
    getOpenaiProvider,
    openaiProviders,
    parseRequestArguments,
    reasoningLevels,
    removeRequestArgument,
    selectOpenaiProvider,
} from './providers';
import { useServiceError } from '@/hooks/useServiceError';
import { useServiceConfigDialog } from '@/components/app/ServiceConfigDialog';
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
import OptionSelect from '@/components/app/OptionSelect';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { translate } from './index';
import { Language } from './index';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';

export const defaultRequestArguments = JSON.stringify({
    temperature: 0.1,
    top_p: 0.99,
    frequency_penalty: 0,
    presence_penalty: 0,
});
const defaultArgumentKeys = Object.keys(JSON.parse(defaultRequestArguments));

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const [preservedAddress, setPreservedAddress] = useState(false);
    const [openaiConfig, setOpenaiConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.openai.title'),
            service: 'openai',
            requestPath: openaiProviders.openai.requestPath,
            model: 'gpt-3.5-turbo',
            apiKey: '',
            stream: false,
            promptList: [
                {
                    role: 'system',
                    content:
                        'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                },
                { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
            ],
            requestArguments: defaultRequestArguments,
            reasoning: 'default',
        },
        { sync: false }
    );
    const reportError = useServiceError(openaiConfig);
    const { fieldError, clearFailure } = useServiceConfigDialog();
    // 兼容旧版本
    if (openaiConfig) {
        if (openaiConfig.promptList === undefined) {
            setOpenaiConfig({
                ...openaiConfig,
                promptList: [
                    {
                        role: 'system',
                        content:
                            'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                    },
                    { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
                ],
            });
        }
        if (openaiConfig.requestArguments === undefined) {
            setOpenaiConfig({
                ...openaiConfig,
                requestArguments: defaultRequestArguments,
            });
        }
    }

    const [isLoading, setIsLoading] = useState(false);

    const toastStyle = useToastStyle();
    const label = (key, values) => t(`services.translate.openai.${key}`, values);
    // Editing the field a test failure points at clears the failure.
    const changeLocated = (fieldKey, patch) => {
        if (fieldError?.fieldKey === fieldKey) clearFailure();
        setOpenaiConfig({ ...openaiConfig, ...patch });
    };

    let userArguments = null;
    let argumentsError = null;
    try {
        userArguments = parseRequestArguments(openaiConfig?.requestArguments ?? '');
    } catch (error) {
        argumentsError = error.detail ?? error.message;
    }
    const reasoning = openaiConfig?.reasoning ?? 'default';
    const reasoningOverridden =
        userArguments !== null &&
        Object.keys(buildReasoningArguments(openaiConfig?.service, reasoning)).some((key) =>
            Object.prototype.hasOwnProperty.call(userArguments, key)
        );
    const rejectedParam = fieldError?.fieldKey === 'requestArguments' ? fieldError.param : '';
    const fixedArguments =
        rejectedParam && userArguments !== null ? removeRequestArgument(userArguments, rejectedParam) : null;

    return (
        openaiConfig !== null && (
            <ConfigForm
                onSubmit={(e) => {
                    e.preventDefault();
                    setIsLoading(true);
                    translate('hello', Language.auto, Language.zh_cn, { config: openaiConfig }).then(
                        () => {
                            setIsLoading(false);
                            setOpenaiConfig(openaiConfig, true);
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
                    value={openaiConfig[INSTANCE_NAME_CONFIG_KEY]}
                    onChange={(value) => {
                        setOpenaiConfig({
                            ...openaiConfig,
                            [INSTANCE_NAME_CONFIG_KEY]: value,
                        });
                    }}
                />

                <ServiceRecommendations currentProvider={openaiConfig.service} />
                <ConfigField
                    fieldKey='service'
                    label={t('services.translate.openai.service')}
                >
                    <OptionSelect
                        className='w-full'
                        value={openaiConfig.service}
                        label={t(`services.translate.openai.${openaiConfig.service}`)}
                        options={Object.keys(openaiProviders).map((key) => ({
                            value: key,
                            label: t(`services.translate.openai.${key}`),
                        }))}
                        onChange={(key) => {
                            const selection = selectOpenaiProvider(openaiConfig, key);
                            setOpenaiConfig(selection.config);
                            setPreservedAddress(selection.preserved);
                        }}
                    />
                </ConfigField>
                <ConfigSwitchRow
                    label={t('services.translate.openai.stream')}
                    checked={openaiConfig['stream'] ?? false}
                    onCheckedChange={(value) => {
                        setOpenaiConfig({
                            ...openaiConfig,
                            stream: value,
                        });
                    }}
                />
                <ConfigField
                    fieldKey='requestPath'
                    label={t('services.translate.openai.request_path')}
                    hint={
                        <span
                            className='flex flex-col gap-1'
                            role='status'
                        >
                            <span>
                                {t(
                                    `services.translate.openai.provider_hint.${Object.prototype.hasOwnProperty.call(openaiProviders, openaiConfig.service) ? openaiConfig.service : 'openai'}`
                                )}
                            </span>
                            {preservedAddress && (
                                <span>
                                    {t('services.translate.openai.address_preserved')}{' '}
                                    <Button
                                        type='button'
                                        variant='link'
                                        className='h-auto whitespace-normal p-0 text-[length:inherit]'
                                        onClick={() => {
                                            setOpenaiConfig({
                                                ...openaiConfig,
                                                requestPath: getOpenaiProvider(openaiConfig.service).requestPath,
                                            });
                                            setPreservedAddress(false);
                                        }}
                                    >
                                        {t('services.translate.openai.use_default_address', {
                                            name: t(`services.translate.openai.${openaiConfig.service}`),
                                        })}
                                    </Button>
                                </span>
                            )}
                        </span>
                    }
                >
                    <Input
                        value={openaiConfig['requestPath'] ?? ''}
                        onChange={(e) => {
                            setPreservedAddress(false);
                            setOpenaiConfig({
                                ...openaiConfig,
                                requestPath: e.target.value,
                            });
                        }}
                    />
                </ConfigField>
                <ConfigField
                    fieldKey='apiKey'
                    label={t('services.translate.openai.api_key')}
                    labelAction={
                        <Button
                            type='button'
                            variant='link'
                            className='h-auto p-0 text-xs'
                            onClick={() => open(getOpenaiProvider(openaiConfig.service).keyUrl)}
                        >
                            {t('services.translate.openai.get_key')}
                        </Button>
                    }
                >
                    <SecretInput
                        value={openaiConfig['apiKey'] ?? ''}
                        onChange={(e) => {
                            setOpenaiConfig({
                                ...openaiConfig,
                                apiKey: e.target.value,
                            });
                        }}
                    />
                </ConfigField>
                {openaiConfig.service !== 'azure' && (
                    <ConfigField
                        fieldKey='model'
                        label={t('services.translate.openai.model')}
                    >
                        <Input
                            value={openaiConfig['model'] ?? ''}
                            onChange={(e) => {
                                setOpenaiConfig({
                                    ...openaiConfig,
                                    model: e.target.value,
                                });
                            }}
                        />
                    </ConfigField>
                )}
                <ConfigField
                    fieldKey='reasoning'
                    label={label('reasoning')}
                    hint={
                        <span className='flex flex-col gap-1'>
                            <span>{label('reasoning_hint')}</span>
                            {reasoningOverridden && <span>{label('reasoning_overridden')}</span>}
                        </span>
                    }
                    error={
                        fieldError?.fieldKey === 'reasoning' && (
                            <span>
                                {label('reasoning_rejected')}{' '}
                                <Button
                                    type='button'
                                    variant='link'
                                    className='h-auto whitespace-normal p-0 text-[length:inherit] text-destructive'
                                    onClick={() => changeLocated('reasoning', { reasoning: 'default' })}
                                >
                                    {label('use_model_default')}
                                </Button>
                            </span>
                        )
                    }
                >
                    <OptionSelect
                        className='w-full'
                        value={reasoning}
                        label={label(`reasoning_${reasoning}`)}
                        options={reasoningLevels.map((value) => ({
                            value,
                            label: label(`reasoning_${value}`),
                        }))}
                        onChange={(value) => changeLocated('reasoning', { reasoning: value })}
                    />
                </ConfigField>
                <ConfigPromptList
                    description={t('services.translate.openai.prompt_description')}
                    prompts={(openaiConfig.promptList ?? []).map((prompt) => ({
                        role: prompt.role,
                        text: prompt.content,
                    }))}
                    onChange={(index, value) => {
                        setOpenaiConfig({
                            ...openaiConfig,
                            promptList: openaiConfig.promptList.map((p, i) => {
                                if (i === index) {
                                    if (i === 0) {
                                        return {
                                            role: 'system',
                                            content: value,
                                        };
                                    } else {
                                        return {
                                            role: index % 2 !== 0 ? 'user' : 'assistant',
                                            content: value,
                                        };
                                    }
                                } else {
                                    return p;
                                }
                            }),
                        });
                    }}
                    onDelete={(index) => {
                        setOpenaiConfig({
                            ...openaiConfig,
                            promptList: openaiConfig.promptList.filter((_, i) => i !== index),
                        });
                    }}
                    onAdd={() => {
                        setOpenaiConfig({
                            ...openaiConfig,
                            promptList: [
                                ...openaiConfig.promptList,
                                {
                                    role:
                                        openaiConfig.promptList.length === 0
                                            ? 'system'
                                            : openaiConfig.promptList.length % 2 === 0
                                              ? 'assistant'
                                              : 'user',
                                    content: '',
                                },
                            ],
                        });
                    }}
                    addLabel={t('services.translate.openai.add')}
                />
                <ConfigField
                    fieldKey='requestArguments'
                    label={label('request_arguments')}
                    hint={label('request_arguments_hint')}
                    error={
                        argumentsError ? (
                            label('request_arguments_invalid', { error: argumentsError })
                        ) : rejectedParam ? (
                            <span className='flex flex-col gap-1'>
                                <span>{label('param_rejected', { param: rejectedParam })}</span>
                                {defaultArgumentKeys.includes(rejectedParam) && (
                                    <span>{label('default_params_note')}</span>
                                )}
                                {fixedArguments !== null && (
                                    <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                                        <span>
                                            {label('preview_after_fix')}{' '}
                                            <code className='break-all font-mono text-xs'>{fixedArguments}</code>
                                        </span>
                                        <Button
                                            type='button'
                                            variant='link'
                                            className='h-auto p-0 text-[length:inherit] text-destructive'
                                            onClick={() =>
                                                changeLocated('requestArguments', { requestArguments: fixedArguments })
                                            }
                                        >
                                            {label('apply_suggestion')}
                                        </Button>
                                    </span>
                                )}
                            </span>
                        ) : null
                    }
                >
                    <Textarea
                        value={openaiConfig['requestArguments'] ?? ''}
                        placeholder='{}'
                        onChange={(e) => changeLocated('requestArguments', { requestArguments: e.target.value })}
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
