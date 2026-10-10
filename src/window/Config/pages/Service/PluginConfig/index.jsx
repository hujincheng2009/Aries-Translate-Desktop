import { INSTANCE_NAME_CONFIG_KEY } from '../../../../../utils/service_instance';
import { useTranslation } from 'react-i18next';
import React from 'react';

import OptionSelect from '@/components/app/OptionSelect';
import {
    ConfigField,
    ConfigFooter,
    ConfigForm,
    ConfigGuide,
    ConfigNote,
    InstanceNameField,
} from '@/components/app/ServiceConfigForm';
import { Input } from '@/components/ui/input';
import { useConfig } from '../../../../../hooks';

export function PluginConfig(props) {
    const { instanceKey, updateServiceList, onClose, name, pluginList } = props;
    const [pluginConfig, setPluginConfig] = useConfig(instanceKey, {}, { sync: false });
    const { t } = useTranslation();

    return (
        <ConfigForm>
            <ConfigGuide
                url={pluginList[name].homepage}
                label={t('config.service.homepage')}
                buttonText={t('config.service.homepage')}
            />
            {pluginConfig && (
                <InstanceNameField
                    value={pluginConfig[INSTANCE_NAME_CONFIG_KEY] ?? pluginList[name].display}
                    onChange={(value) => {
                        setPluginConfig({
                            ...pluginConfig,
                            [INSTANCE_NAME_CONFIG_KEY]: value,
                        });
                    }}
                />
            )}

            {pluginList[name].needs.length === 0 ? (
                <ConfigNote>{t('services.no_need')}</ConfigNote>
            ) : (
                pluginList[name].needs.map((x) => {
                    if (!pluginConfig) return null;
                    if (x.type === 'select') {
                        const current = pluginConfig.hasOwnProperty(x.key)
                            ? pluginConfig[x.key]
                            : Object.keys(x.options)[0];
                        return (
                            <ConfigField
                                key={x.key}
                                label={x.display}
                            >
                                <OptionSelect
                                    className='w-full'
                                    value={current}
                                    label={x.options[current]}
                                    options={Object.keys(x.options).map((y) => ({ value: y, label: x.options[y] }))}
                                    onChange={(key) => {
                                        setPluginConfig({
                                            ...pluginConfig,
                                            [x.key]: key,
                                        });
                                    }}
                                />
                            </ConfigField>
                        );
                    }
                    if (x.type && x.type !== 'input') {
                        // unknown field type: only the label was rendered before
                        return (
                            <ConfigField
                                key={x.key}
                                label={x.display}
                            />
                        );
                    }
                    // `input` fields, and legacy fields declared without a type, are rendered as text inputs
                    return (
                        <ConfigField
                            key={x.key}
                            label={x.display}
                            hint={x.type === 'input' ? x.description : undefined}
                        >
                            <Input
                                value={`${pluginConfig.hasOwnProperty(x.key) ? pluginConfig[x.key] : ''}`}
                                onChange={(e) => {
                                    setPluginConfig({
                                        ...pluginConfig,
                                        [x.key]: e.target.value,
                                    });
                                }}
                            />
                        </ConfigField>
                    );
                })
            )}

            <ConfigFooter
                onCancel={onClose}
                onSave={() => {
                    setPluginConfig(pluginConfig, true);
                    updateServiceList(instanceKey);
                    onClose();
                }}
            />
        </ConfigForm>
    );
}
