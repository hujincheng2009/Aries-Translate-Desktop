import { Copy, Minus, Square, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { appWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

export default function WindowControl() {
    const [isMax, setIsMax] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        listen('tauri://resize', async () => {
            if (await appWindow.isMaximized()) {
                setIsMax(true);
            } else {
                setIsMax(false);
            }
        });
    }, []);

    return (
        <div className='flex items-center'>
            <Button
                variant='ghost'
                size='icon-sm'
                aria-label={t('common.minimize')}
                onClick={() => appWindow.minimize()}
            >
                <Minus />
            </Button>
            <Button
                variant='ghost'
                size='icon-sm'
                aria-label={isMax ? t('common.restore') : t('common.maximize')}
                onClick={() => {
                    if (isMax) {
                        appWindow.unmaximize();
                    } else {
                        appWindow.maximize();
                    }
                }}
            >
                {isMax ? <Copy className='size-3.5 -scale-x-100' /> : <Square className='size-3.5' />}
            </Button>
            <Button
                variant='ghost'
                size='icon-sm'
                aria-label={t('common.close')}
                // Windows convention: the close button turns red on hover
                className='hover:bg-destructive hover:text-white dark:hover:bg-destructive'
                onClick={() => appWindow.close()}
            >
                <X />
            </Button>
        </div>
    );
}
