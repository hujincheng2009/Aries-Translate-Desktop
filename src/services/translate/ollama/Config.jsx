import { useServiceError } from '@/hooks/useServiceError';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { Ollama } from 'ollama/browser';

import {
    ConfigCallout,
    ConfigField,
    ConfigFooter,
    ConfigForm,
    ConfigLink,
    ConfigNote,
    ConfigPromptList,
    ConfigSwitchRow,
    InstanceNameField,
} from '@/components/app/ServiceConfigForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress, Spinner } from '@/components/ui/misc';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
            [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.ollama.title'),
            stream: true,
            model: 'gemma:2b',
            requestPath: 'http://localhost:11434',
            promptList: [
                {
                    role: 'system',
                    content:
                        'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                },
                { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
            ],
        },
        { sync: false }
    );
    const reportError = useServiceError(serviceConfig);
    const [isLoading, setIsLoading] = useState(false);
    const [isPulling, setIsPulling] = useState(false);
    const [progress, setProgress] = useState(0);
    const [pullingStatus, setPullingStatus] = useState('');
    const [installedModels, setInstalledModels] = useState(null);

    const toastStyle = useToastStyle();

    async function getModles() {
        try {
            const ollama = new Ollama({ host: serviceConfig.requestPath });
            const list = await ollama.list();
            setInstalledModels(list);
        } catch {
            setInstalledModels(null);
        }
    }

    async function pullModel() {
        setIsPulling(true);
        const ollama = new Ollama({ host: serviceConfig.requestPath });
        const stream = await ollama.pull({ model: serviceConfig.model, stream: true });
        for await (const part of stream) {
            if (part.digest) {
                let percent = 0;
                if (part.completed && part.total) {
                    percent = Math.round((part.completed / part.total) * 100);
                }
                setProgress(percent);
                setPullingStatus(part.status);
            } else {
                setProgress(0);
                setPullingStatus(part.status);
            }
        }
        setProgress(0);
        setPullingStatus('');
        setIsPulling(false);
        getModles();
    }

    useEffect(() => {
        if (serviceConfig !== null) {
            getModles();
        }
    }, [serviceConfig]);

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
                {installedModels === null && (
                    <ConfigCallout variant='destructive'>
                        {t('services.translate.ollama.install_ollama')}
                        <br />
                        <ConfigLink href='https://ollama.com/download'>
                            {t('services.translate.ollama.install_ollama_link')}
                        </ConfigLink>
                    </ConfigCallout>
                )}

                <ConfigSwitchRow
                    label={t('services.translate.ollama.stream')}
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
                    label={t('services.translate.ollama.request_path')}
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
                    fieldKey='model'
                    label={t('services.translate.ollama.model')}
                >
                    {({ id, describedBy }) => (
                        <div className='relative'>
                            <Input
                                id={id}
                                aria-describedby={describedBy}
                                className='pr-20'
                                value={serviceConfig['model'] ?? ''}
                                onChange={(e) => {
                                    setServiceConfig({
                                        ...serviceConfig,
                                        model: e.target.value,
                                    });
                                }}
                            />
                            <div className='absolute right-1.5 top-1/2 -translate-y-1/2'>
                                {installedModels &&
                                !installedModels.models
                                    .map((model) => {
                                        return model.name;
                                    })
                                    .includes(serviceConfig['model']) ? (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    type='button'
                                                    size='xs'
                                                    variant='outline'
                                                    disabled={isPulling}
                                                    onClick={pullModel}
                                                >
                                                    {isPulling && <Spinner className='size-3' />}
                                                    {t('services.translate.ollama.install_model')}
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                {t('services.translate.ollama.not_installed')}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ) : (
                                    <Button
                                        type='button'
                                        size='xs'
                                        variant='secondary'
                                        disabled
                                    >
                                        {t('services.translate.ollama.ready')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </ConfigField>
                {isPulling && (
                    <div className='flex flex-col gap-1.5'>
                        <div className='flex items-center justify-between gap-2 text-[0.8125rem] text-muted-foreground'>
                            <span className='min-w-0 truncate'>{pullingStatus}</span>
                            <span>{progress}%</span>
                        </div>
                        <Progress value={progress} />
                    </div>
                )}
                <ConfigNote>
                    <ConfigLink href='https://ollama.com/library'>
                        {t('services.translate.ollama.supported_models')}
                    </ConfigLink>
                </ConfigNote>
                <ConfigPromptList
                    description={t('services.translate.ollama.prompt_description')}
                    prompts={(serviceConfig.promptList ?? []).map((prompt) => ({
                        role: prompt.role,
                        text: prompt.content,
                    }))}
                    onChange={(index, value) => {
                        setServiceConfig({
                            ...serviceConfig,
                            promptList: serviceConfig.promptList.map((p, i) => {
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
                        setServiceConfig({
                            ...serviceConfig,
                            promptList: serviceConfig.promptList.filter((_, i) => i !== index),
                        });
                    }}
                    onAdd={() => {
                        setServiceConfig({
                            ...serviceConfig,
                            promptList: [
                                ...serviceConfig.promptList,
                                {
                                    role:
                                        serviceConfig.promptList.length === 0
                                            ? 'system'
                                            : serviceConfig.promptList.length % 2 === 0
                                              ? 'assistant'
                                              : 'user',
                                    content: '',
                                },
                            ],
                        });
                    }}
                    addLabel={t('services.translate.ollama.add')}
                />
                <ConfigFooter
                    onCancel={onClose}
                    isLoading={isLoading}
                />
            </ConfigForm>
        )
    );
}
