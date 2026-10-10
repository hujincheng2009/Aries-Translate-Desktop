import { useServiceError } from '@/hooks/useServiceError';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

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
import { Spinner } from '@/components/ui/misc';

import { useToastStyle } from '../../../hooks';
import { useConfig } from '../../../hooks/useConfig';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import { GOOGLE_OCR_CHECK_IMAGE_BASE64 } from './check_image';
import { GOOGLE_OCR_DETECTION_TYPES } from './core';
import { Language } from './info';
import { recognize, validateGoogleOcrConfig } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();
    const toastStyle = useToastStyle();
    const [isTesting, setIsTesting] = useState(false);
    const [config, setConfig] = useConfig(
        instanceKey,
        {
            [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.google_ocr.title'),
            api_key: '',
            detection_type: GOOGLE_OCR_DETECTION_TYPES[0],
        },
        { sync: false }
    );
    const reportError = useServiceError(config);

    const showError = (error) => {
        reportError(error);
    };

    const testConnection = async () => {
        setIsTesting(true);
        try {
            validateGoogleOcrConfig(config);
            const result = await recognize(GOOGLE_OCR_CHECK_IMAGE_BASE64, Language.en, { config });
            if (!result.trim()) throw new Error('No text was recognized in the test image.');
            toast.success(t('services.recognize.google_ocr.test_success'), { style: toastStyle });
        } catch (error) {
            showError(error);
        } finally {
            setIsTesting(false);
        }
    };

    const saveConfig = () => {
        try {
            validateGoogleOcrConfig(config);
            setConfig(config, true);
            updateServiceList(instanceKey);
            onClose();
        } catch (error) {
            showError(error);
        }
    };

    if (config === null) return null;

    const detectionType = config.detection_type || GOOGLE_OCR_DETECTION_TYPES[0];

    return (
        <ConfigForm>
            <Toaster />
            <InstanceNameField
                value={config[INSTANCE_NAME_CONFIG_KEY] ?? ''}
                onChange={(value) => setConfig({ ...config, [INSTANCE_NAME_CONFIG_KEY]: value })}
            />
            <ConfigField
                fieldKey='api_key'
                label={t('services.recognize.google_ocr.api_key')}
                hint={t('services.recognize.google_ocr.api_key_hint')}
            >
                <SecretInput
                    value={config.api_key ?? ''}
                    onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                />
            </ConfigField>
            <ConfigField
                label={t('services.recognize.google_ocr.detection_type')}
                hint={t('services.recognize.google_ocr.detection_type_hint')}
            >
                <OptionSelect
                    className='w-full'
                    value={detectionType}
                    label={t(`services.recognize.google_ocr.detection_${detectionType.toLowerCase()}`)}
                    options={GOOGLE_OCR_DETECTION_TYPES.map((type) => ({
                        value: type,
                        label: t(`services.recognize.google_ocr.detection_${type.toLowerCase()}`),
                    }))}
                    onChange={(value) => {
                        if (value) setConfig({ ...config, detection_type: value });
                    }}
                />
            </ConfigField>
            <ConfigNote>{t('services.recognize.google_ocr.billing_hint')}</ConfigNote>
            <ConfigFooter
                onCancel={onClose}
                onSave={saveConfig}
            >
                <Button
                    type='button'
                    variant='outline'
                    disabled={isTesting}
                    onClick={() => void testConnection()}
                >
                    {isTesting && <Spinner />}
                    {t('services.recognize.google_ocr.test')}
                </Button>
            </ConfigFooter>
        </ConfigForm>
    );
}
