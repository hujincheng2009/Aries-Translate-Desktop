import React, { useEffect, useRef, useState } from 'react';
import { useServiceError } from '@/hooks/useServiceError';
import { createPortal } from 'react-dom';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useConfig } from '../../../hooks/useConfig';
import { useToastStyle } from '../../../hooks';
import { store } from '../../../utils/store';
import { emit } from '@tauri-apps/api/event';
import OptionSelect from '@/components/app/OptionSelect';
import {
    ConfigField,
    ConfigFooter,
    ConfigForm,
    ConfigNote,
    ConfigSwitchRow,
    InstanceNameField,
    SecretInput,
} from '@/components/app/ServiceConfigForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';
import { Textarea } from '@/components/ui/textarea';
import {
    GEMINI_FREE_DEFAULT_CONFIG,
    GEMINI_FREE_SYSTEM_PROMPT,
    GEMINI_FREE_USER_PROMPT,
    normalizeGeminiFreeConfig,
    stopsGeminiFree,
} from './core.js';
import { geminiFreeCooldowns, geminiFreeFingerprint, geminiFreeModelStore, testModel } from './index';

export function Config({ instanceKey, updateServiceList, onClose }) {
    const { t } = useTranslation();
    const label = (key, values) => t(`services.translate.gemini_free.${key}`, values);
    const [config, setConfig] = useConfig(instanceKey, GEMINI_FREE_DEFAULT_CONFIG, { sync: false });
    const reportError = useServiceError(config);
    const [addition, setAddition] = useState('');
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [results, setResults] = useState({});
    const [, refresh] = useState(0);
    const alive = useRef(true);
    const toastStyle = useToastStyle();
    useEffect(() => {
        alive.current = true;
        const timer = setInterval(() => refresh((value) => value + 1), 1000);
        const update = () => refresh((value) => value + 1);
        window.addEventListener('storage', update);
        return () => {
            alive.current = false;
            clearInterval(timer);
            window.removeEventListener('storage', update);
        };
    }, []);
    if (!config) return null;
    const models = Array.isArray(config.models)
        ? config.models
        : String(config.models ?? '')
              .split(/[,\n]+/)
              .map((value) => value.trim())
              .filter(Boolean);
    const change = (key, value) => setConfig({ ...config, [key]: value });
    const add = () => {
        const model = addition.trim();
        if (model && !models.includes(model)) change('models', [...models, model]);
        setAddition('');
    };
    const status = (model) => {
        const key = `${geminiFreeFingerprint(config.apiKey ?? '')}|${model}`;
        const cooldown = geminiFreeCooldowns.read()[key];
        if (cooldown?.kind === 'quota_daily')
            return label('status_daily', {
                time: new Date(cooldown.until).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
            });
        if (cooldown?.kind === 'rate_limited')
            return label('status_rate', { seconds: Math.max(1, Math.ceil((cooldown.until - Date.now()) / 1000)) });
        if (cooldown?.kind === 'not_found') return label('status_missing');
        const state = geminiFreeModelStore.get(key);
        if (state?.lastSuccessAt) {
            const date = new Date(state.lastSuccessAt);
            return label('status_success', {
                time: date.toLocaleString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    ...(date.toDateString() === new Date().toDateString() ? {} : { month: 'numeric', day: 'numeric' }),
                }),
            });
        }
        return label('status_unused');
    };
    const validate = () => {
        try {
            return normalizeGeminiFreeConfig(config);
        } catch (error) {
            toast.error(label(error.validationKey), { style: toastStyle });
            return null;
        }
    };
    const test = async () => {
        const normalized = validate();
        if (!normalized) return;
        setTesting(true);
        setResults({});
        try {
            for (const model of normalized.models) {
                if (!alive.current) break;
                setResults((previous) => ({ ...previous, [model]: label('testing') }));
                try {
                    const result = await testModel(normalized, model);
                    if (alive.current)
                        setResults((previous) => ({
                            ...previous,
                            [model]: label('test_success', { ms: result.elapsedMs }),
                        }));
                } catch (error) {
                    if (alive.current) reportError(error);
                    const kind = error.failures?.at(-1)?.kind ?? 'other';
                    if (alive.current)
                        setResults((previous) => ({
                            ...previous,
                            [model]: label(`errors.${kind}`, {
                                time: new Date(error.failures?.at(-1)?.cooldownUntil ?? Date.now()).toLocaleTimeString(
                                    undefined,
                                    { hour: '2-digit', minute: '2-digit' }
                                ),
                                seconds: Math.max(
                                    1,
                                    Math.ceil(
                                        ((error.failures?.at(-1)?.cooldownUntil ?? Date.now() + 60000) - Date.now()) /
                                            1000
                                    )
                                ),
                            }),
                        }));
                    if (stopsGeminiFree(kind) && kind !== 'blocked') break;
                }
            }
        } finally {
            if (alive.current) setTesting(false);
        }
    };
    const save = async (event) => {
        event.preventDefault();
        const normalized = validate();
        if (!normalized) return;
        setSaving(true);
        try {
            await store.set(instanceKey, normalized);
            await store.save();
            geminiFreeCooldowns.clearWhere((key) => key.startsWith(`${geminiFreeFingerprint(normalized.apiKey)}|`));
            await emit(`${instanceKey.replaceAll('.', '_').replaceAll('@', ':')}_changed`, normalized);
            updateServiceList(instanceKey);
            onClose();
        } catch {
            toast.error(t('common.save') + ': ' + label('errors.other'), { style: toastStyle });
        } finally {
            if (alive.current) setSaving(false);
        }
    };
    const busy = testing || saving;
    return (
        <ConfigForm onSubmit={save}>
            <Toaster />
            <InstanceNameField
                value={config.instanceName}
                onChange={(value) => change('instanceName', value)}
                disabled={busy}
            />
            <ConfigField
                fieldKey='apiKey'
                label={label('api_key')}
                hint={label('api_key_hint')}
            >
                <SecretInput
                    value={config.apiKey ?? ''}
                    onChange={(e) => change('apiKey', e.target.value)}
                    disabled={busy}
                />
            </ConfigField>
            <ConfigField
                fieldKey='requestPath'
                label={label('request_path')}
                hint={label('request_path_hint')}
            >
                <Input
                    value={config.requestPath ?? ''}
                    onChange={(e) => change('requestPath', e.target.value)}
                    disabled={busy}
                />
            </ConfigField>
            <ConfigSwitchRow
                label={label('stream')}
                checked={config.stream ?? false}
                onCheckedChange={(value) => change('stream', value)}
                disabled={busy}
            />
            <ConfigField
                fieldKey='thinking'
                label={label('thinking')}
                hint={label('thinking_hint')}
            >
                <OptionSelect
                    className='w-full'
                    value={config.thinking ?? 'lowest'}
                    label={label(`thinking_${config.thinking ?? 'lowest'}`)}
                    options={['lowest', 'low', 'medium', 'high', 'default'].map((value) => ({
                        value,
                        label: label(`thinking_${value}`),
                    }))}
                    onChange={(value) => change('thinking', value)}
                    disabled={busy}
                />
            </ConfigField>
            <ConfigField
                fieldKey='models'
                value={models}
                label={label('models')}
            >
                <DragDropContext
                    onDragEnd={({ source, destination }) => {
                        if (!destination) return;
                        const next = [...models];
                        const [model] = next.splice(source.index, 1);
                        next.splice(destination.index, 0, model);
                        change('models', next);
                    }}
                >
                    <Droppable droppableId={`gemini-free-${instanceKey}`}>
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className='flex flex-col gap-2'
                            >
                                {models.map((model, index) => (
                                    <Draggable
                                        key={model}
                                        draggableId={model}
                                        index={index}
                                        isDragDisabled={busy}
                                    >
                                        {(drag, snapshot) => {
                                            const row = (
                                                <div
                                                    ref={drag.innerRef}
                                                    {...drag.draggableProps}
                                                    className='flex items-center gap-2 rounded-lg border bg-card p-2 text-card-foreground shadow-xs'
                                                >
                                                    <span
                                                        {...drag.dragHandleProps}
                                                        aria-label={label('models')}
                                                        className='flex shrink-0 cursor-grab items-center text-muted-foreground'
                                                    >
                                                        <GripVertical className='size-4' />
                                                    </span>
                                                    <div className='flex min-w-0 flex-1 flex-col items-start gap-1'>
                                                        <div className='break-all text-sm'>{model}</div>
                                                        <Badge variant='secondary'>{status(model)}</Badge>
                                                        {results[model] && (
                                                            <div
                                                                className='text-xs text-muted-foreground'
                                                                role='status'
                                                            >
                                                                {results[model]}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        type='button'
                                                        variant='ghost'
                                                        size='icon-sm'
                                                        className='text-muted-foreground hover:text-destructive'
                                                        aria-label={label('delete')}
                                                        disabled={busy}
                                                        onClick={() =>
                                                            change(
                                                                'models',
                                                                models.filter((value) => value !== model)
                                                            )
                                                        }
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>
                                            );
                                            return snapshot.isDragging ? createPortal(row, document.body) : row;
                                        }}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
                <div className='flex gap-2'>
                    <Input
                        aria-label={label('add_model')}
                        placeholder={label('add_model')}
                        value={addition}
                        onChange={(e) => setAddition(e.target.value)}
                        disabled={busy}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                add();
                            }
                        }}
                    />
                    <Button
                        type='button'
                        variant='outline'
                        size='icon'
                        aria-label={label('add_model')}
                        onClick={add}
                        disabled={busy}
                    >
                        <Plus />
                    </Button>
                </div>
                <ConfigNote>{label('quota_hint')}</ConfigNote>
            </ConfigField>
            <ConfigField
                fieldKey='systemPrompt'
                label={label('system_prompt')}
            >
                <Textarea
                    value={config.systemPrompt ?? ''}
                    onChange={(e) => change('systemPrompt', e.target.value)}
                    disabled={busy}
                />
            </ConfigField>
            <ConfigField
                fieldKey='userPrompt'
                label={label('user_prompt')}
            >
                <Textarea
                    value={config.userPrompt ?? ''}
                    onChange={(e) => change('userPrompt', e.target.value)}
                    disabled={busy}
                />
            </ConfigField>
            <ConfigNote>{label('variables')}</ConfigNote>
            <Button
                type='button'
                variant='outline'
                className='self-start'
                onClick={() =>
                    setConfig({
                        ...config,
                        systemPrompt: GEMINI_FREE_SYSTEM_PROMPT,
                        userPrompt: GEMINI_FREE_USER_PROMPT,
                    })
                }
                disabled={busy}
            >
                {label('restore_prompts')}
            </Button>
            <ConfigNote>{label('privacy')}</ConfigNote>
            <ConfigFooter
                onCancel={onClose}
                isLoading={saving}
                disabled={testing}
            >
                <Button
                    type='button'
                    variant='outline'
                    onClick={test}
                    disabled={saving || testing}
                >
                    {testing && <Spinner />}
                    {label('test_all')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
