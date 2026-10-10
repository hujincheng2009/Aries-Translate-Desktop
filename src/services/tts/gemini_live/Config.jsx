import { useServiceError } from '@/hooks/useServiceError';
import React, { useEffect, useRef, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { emit } from '@tauri-apps/api/event';
import {
    ConfigField,
    ConfigFooter,
    ConfigForm,
    ConfigNote,
    InstanceNameField,
    SecretInput,
} from '@/components/app/ServiceConfigForm';
import OptionSelect from '@/components/app/OptionSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/misc';
import { Textarea } from '@/components/ui/textarea';
import { useToastStyle } from '../../../hooks';
import { useConfig } from '../../../hooks/useConfig';
import { playVoice, stopVoice } from '../../../hooks/useVoice';
import { store } from '../../../utils/store';
import { GEMINI_TTS_VOICES } from '../gemini/core.js';
import {
    DEFAULT_LIVE_CONFIG,
    DEFAULT_PROMPT_ZH,
    DEFAULT_PROMPT_OTHER,
    normalizeGeminiLiveConfig,
    redactGeminiLiveError,
} from './core.js';
import { tts } from './index';

export const GEMINI_LIVE_PREVIEW_ZH = '这是一段中文试听，用来检查朗读是否完整。';
export const GEMINI_LIVE_PREVIEW_EN = 'This is a short English test to check that the whole sentence is read.';
export function Config({ instanceKey, updateServiceList, onClose }) {
    const { t } = useTranslation();
    const label = (key, options) => t(`services.tts.gemini_live_tts.${key}`, options);
    const toastStyle = useToastStyle();
    const [config, setConfig] = useConfig(
        instanceKey,
        { ...DEFAULT_LIVE_CONFIG, instanceName: label('title') },
        { sync: false }
    );
    const reportError = useServiceError(config);
    const [testing, setTesting] = useState(null);
    const [saving, setSaving] = useState(false);
    const alive = useRef(true);
    const testActive = useRef(false);
    const playing = useRef(false);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            if (playing.current) stopVoice();
        };
    }, []);
    if (!config) return null;
    const busy = testing !== null || saving;
    const change = (key, value) => setConfig({ ...config, [key]: value });
    const validate = () => {
        try {
            return normalizeGeminiLiveConfig(config);
        } catch (error) {
            toast.error(label(error.validationKey), { style: toastStyle });
            return null;
        }
    };
    const preview = async (language) => {
        if (testActive.current) return;
        const normalized = validate();
        if (!normalized) return;
        testActive.current = true;
        setTesting(language);
        try {
            const audio = await tts(language === 'zh' ? GEMINI_LIVE_PREVIEW_ZH : GEMINI_LIVE_PREVIEW_EN, 'auto', {
                config: normalized,
            });
            if (!alive.current) return;
            playing.current = true;
            playing.current = await playVoice(audio, {
                onEnded: () => {
                    playing.current = false;
                },
            });
            if (alive.current) toast.success(label('test_success'), { style: toastStyle });
        } catch (error) {
            if (alive.current) reportError(error);
        } finally {
            testActive.current = false;
            if (alive.current) setTesting(null);
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
            await emit(`${instanceKey.replaceAll('.', '_').replaceAll('@', ':')}_changed`, normalized);
            updateServiceList(instanceKey);
            onClose();
        } catch {
            toast.error(label('save_failed'), { style: toastStyle });
        } finally {
            if (alive.current) setSaving(false);
        }
    };
    return (
        <ConfigForm onSubmit={save}>
            <Toaster />
            <InstanceNameField
                value={config.instanceName ?? ''}
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
                    disabled={busy}
                    onChange={(e) => change('apiKey', e.target.value)}
                />
            </ConfigField>
            <ConfigField
                fieldKey='model'
                label={label('model')}
                hint={label('model_hint')}
            >
                <Input
                    value={config.model ?? ''}
                    disabled={busy}
                    onChange={(e) => change('model', e.target.value)}
                />
            </ConfigField>
            <ConfigField
                fieldKey='voice'
                label={label('voice')}
            >
                <OptionSelect
                    className='w-full'
                    value={config.voice || 'Kore'}
                    label={config.voice || 'Kore'}
                    disabled={busy}
                    options={GEMINI_TTS_VOICES.map((voice) => ({ value: voice, label: voice }))}
                    onChange={(value) => {
                        if (value) change('voice', value);
                    }}
                />
            </ConfigField>
            <ConfigField
                fieldKey='attempts'
                label={label('attempts')}
                hint={label('attempts_hint')}
            >
                <OptionSelect
                    className='w-full'
                    value={String(config.attempts ?? 3)}
                    label={String(config.attempts ?? 3)}
                    disabled={busy}
                    options={[1, 2, 3].map((count) => ({ value: String(count), label: String(count) }))}
                    onChange={(value) => {
                        if (value) change('attempts', Number(value));
                    }}
                />
            </ConfigField>
            <ConfigField
                fieldKey='promptZh'
                label={label('prompt_zh')}
            >
                <Textarea
                    value={config.promptZh ?? ''}
                    disabled={busy}
                    onChange={(e) => change('promptZh', e.target.value)}
                />
            </ConfigField>
            <ConfigField
                fieldKey='promptOther'
                label={label('prompt_other')}
            >
                <Textarea
                    value={config.promptOther ?? ''}
                    disabled={busy}
                    onChange={(e) => change('promptOther', e.target.value)}
                />
            </ConfigField>
            <Button
                type='button'
                variant='outline'
                className='self-start'
                disabled={busy}
                onClick={() => setConfig({ ...config, promptZh: DEFAULT_PROMPT_ZH, promptOther: DEFAULT_PROMPT_OTHER })}
            >
                {label('restore_prompts')}
            </Button>
            <ConfigNote>{label('service_hint')}</ConfigNote>
            <ConfigNote>{label('privacy_hint')}</ConfigNote>
            <ConfigFooter
                onCancel={onClose}
                isLoading={saving}
                disabled={testing !== null}
            >
                <Button
                    type='button'
                    variant='outline'
                    disabled={busy && testing !== 'zh'}
                    onClick={() => void preview('zh')}
                >
                    {testing === 'zh' && <Spinner />}
                    {label('test_zh')}
                </Button>
                <Button
                    type='button'
                    variant='outline'
                    disabled={busy && testing !== 'en'}
                    onClick={() => void preview('en')}
                >
                    {testing === 'en' && <Spinner />}
                    {label('test_en')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
