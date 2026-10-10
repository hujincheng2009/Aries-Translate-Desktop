import { appLogDir, appConfigDir } from '@tauri-apps/api/path';
import { ExternalLink, FileText, FolderOpen, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/shell';
import React, { useState } from 'react';
import licenseText from '../../../../../LICENSE?raw';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import IconRow from '../../../../components/app/IconRow';
import { appVersion } from '../../../../utils/env';

export const ABOUT_LINKS = {
    website: null,
    repository: 'https://github.com/hujincheng2009/Aries-Translate-Desktop',
    feedback: [],
    community: [],
};

export default function About() {
    const { t } = useTranslation();
    const [licenseOpen, setLicenseOpen] = useState(false);

    return (
        <div className='flex flex-col items-center gap-6'>
            <div className='flex flex-col items-center gap-2 pt-2'>
                <img
                    src='icon.png'
                    className='size-20 rounded-[18px]'
                    draggable={false}
                />
                <h1 className='text-2xl font-semibold leading-8'>{t('common.app_name')}</h1>
                <Badge variant='secondary'>{appVersion}</Badge>
                <p className='text-center text-sm text-muted-foreground'>{t('config.about.tagline')}</p>
            </div>
            <div className='flex w-full max-w-[600px] flex-col gap-6'>
                <Card className='gap-0 py-0'>
                    <IconRow
                        icon={<FileText />}
                        title={t('config.about.view_log')}
                        description={t('config.about.view_log_desc')}
                    >
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={async () => {
                                const dir = await appLogDir();
                                open(dir);
                            }}
                        >
                            <FolderOpen />
                            {t('config.about.open')}
                        </Button>
                    </IconRow>
                    <IconRow
                        icon={<Settings />}
                        title={t('config.about.view_config')}
                        description={t('config.about.view_config_desc')}
                    >
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={async () => {
                                const dir = await appConfigDir();
                                open(dir);
                            }}
                        >
                            <FolderOpen />
                            {t('config.about.open')}
                        </Button>
                    </IconRow>
                </Card>
                <section className='text-sm text-muted-foreground'>
                    <h2 className='mb-2 font-medium'>{t('config.about.license_title')}</h2>
                    <p>{t('config.about.copyright')}</p>
                    <p>{t('config.about.original_copyright')}</p>
                    <p className='mt-2'>{t('config.about.license_description')}</p>
                    <p className='mt-2'>{t('config.about.source_access')}</p>
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setLicenseOpen(true)}
                        >
                            <FileText />
                            {t('config.about.view_license')}
                        </Button>
                        {ABOUT_LINKS.repository && (
                            <Button
                                variant='outline'
                                size='sm'
                                onClick={() => open(ABOUT_LINKS.repository)}
                            >
                                <ExternalLink />
                                {t('config.about.get_source')}
                            </Button>
                        )}
                    </div>
                </section>
            </div>
            <Dialog
                open={licenseOpen}
                onOpenChange={setLicenseOpen}
            >
                <DialogContent className='max-h-[85vh] max-w-3xl'>
                    <DialogHeader>
                        <DialogTitle>{t('config.about.view_license')}</DialogTitle>
                        <DialogDescription>GNU GPL-3.0</DialogDescription>
                    </DialogHeader>
                    <pre className='max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-xs text-muted-foreground'>
                        {licenseText}
                    </pre>
                </DialogContent>
            </Dialog>
        </div>
    );
}
