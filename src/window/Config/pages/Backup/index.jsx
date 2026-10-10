import toast, { Toaster } from 'react-hot-toast';
import { Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { warn } from 'tauri-plugin-log-api';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/misc';
import OptionSelect from '../../../../components/app/OptionSelect';
import SettingsSection from '../../../../components/app/SettingsSection';
import SettingRow, { SettingFields } from '../../../../components/app/SettingRow';
import { useConfig, useToastStyle } from '../../../../hooks';
import { osType } from '../../../../utils/env';
import * as webdav from './utils/webdav';
import WebDavModal from './WebDavModal';
import * as local from './utils/local';

export default function Backup() {
    const [storedBackupType, setBackupType] = useConfig('backup_type', 'webdav');
    const backupType =
        storedBackupType === null ? null : ['webdav', 'local'].includes(storedBackupType) ? storedBackupType : 'webdav';
    const [davUserName, setDavUserName] = useConfig('webdav_username', '');
    const [davPassword, setDavPassword] = useConfig('webdav_password', '');
    const [davUrl, setDavUrl] = useConfig('webdav_url', '');
    const [isWebDavListOpen, setWebDavListOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const toastStyle = useToastStyle();
    const { t } = useTranslation();

    const onBackup = async () => {
        setUploading(true);
        const time = new Date();
        const fileName = `${osType}-${time.getFullYear()}-${
            time.getMonth() + 1
        }-${time.getDate()}-${time.getHours()}-${time.getMinutes()}-${time.getSeconds()}`;

        let result;
        switch (backupType) {
            case 'webdav':
                result = webdav.backup(davUrl, davUserName, davPassword, fileName + '.zip');
                break;
            case 'local':
                result = local.backup(fileName);
                break;
            default:
                warn('Unknown backup type');
                setUploading(false);
                return;
        }
        result.then(
            () => {
                toast.success(t('config.backup.backup_success'), { style: toastStyle });
                setUploading(false);
            },
            (e) => {
                toast.error(e.toString(), { style: toastStyle });
                setUploading(false);
            }
        );
    };

    const onBackupListOpen = () => {
        switch (backupType) {
            case 'webdav':
                setWebDavListOpen(true);
                break;
            case 'local':
                local.get().then(
                    () => {
                        toast.success(t('config.backup.load_success'), { style: toastStyle });
                    },
                    (e) => {
                        toast.error(e.toString(), { style: toastStyle });
                    }
                );
                break;
            default:
                warn('Unknown backup type');
        }
    };

    const backupTypeOptions = [
        { value: 'webdav', label: t('config.backup.webdav') },
        { value: 'local', label: t('config.backup.local') },
    ];

    return (
        <>
            <Toaster />
            <SettingsSection
                title={t('config.backup.section.title')}
                description={t('config.backup.section.description')}
            >
                <SettingRow
                    title={t('config.backup.type')}
                    description={t('config.backup.type_desc')}
                >
                    {backupType !== null && (
                        <OptionSelect
                            ariaLabel={t('config.backup.type')}
                            value={backupType}
                            label={t(`config.backup.${backupType}`)}
                            options={backupTypeOptions}
                            onChange={setBackupType}
                        />
                    )}
                </SettingRow>
                {backupType === 'webdav' && (
                    <SettingFields>
                        <div className='flex flex-col gap-2'>
                            <Label htmlFor='backup-webdav-url'>{t('config.backup.webdav_url')}</Label>
                            {davUrl !== null && (
                                <Input
                                    id='backup-webdav-url'
                                    value={davUrl}
                                    onChange={(e) => {
                                        setDavUrl(e.target.value);
                                    }}
                                />
                            )}
                        </div>
                        <div className='grid grid-cols-2 gap-4'>
                            <div className='flex flex-col gap-2'>
                                <Label htmlFor='backup-webdav-username'>{t('config.backup.username')}</Label>
                                {davUserName !== null && (
                                    <Input
                                        id='backup-webdav-username'
                                        value={davUserName}
                                        onChange={(e) => {
                                            setDavUserName(e.target.value);
                                        }}
                                    />
                                )}
                            </div>
                            <div className='flex flex-col gap-2'>
                                <Label htmlFor='backup-webdav-password'>{t('config.backup.password')}</Label>
                                {davPassword !== null && (
                                    <Input
                                        id='backup-webdav-password'
                                        type='password'
                                        value={davPassword}
                                        onChange={(e) => {
                                            setDavPassword(e.target.value);
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </SettingFields>
                )}
                <div className='flex flex-wrap justify-end gap-2 px-4 py-3'>
                    <Button
                        variant='outline'
                        onClick={onBackupListOpen}
                    >
                        <Download />
                        {t('config.backup.restore')}
                    </Button>
                    <Button
                        disabled={uploading}
                        onClick={onBackup}
                    >
                        {uploading ? <Spinner /> : <Upload />}
                        {t('config.backup.backup_now')}
                    </Button>
                </div>
            </SettingsSection>
            <WebDavModal
                isOpen={isWebDavListOpen}
                onOpenChange={setWebDavListOpen}
                url={davUrl}
                username={davUserName}
                password={davPassword}
            />
        </>
    );
}
