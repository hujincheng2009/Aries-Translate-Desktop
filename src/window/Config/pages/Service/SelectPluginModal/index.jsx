import { Package, Plus, Trash2, Upload } from 'lucide-react';
import { removeDir, BaseDirectory } from '@tauri-apps/api/fs';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/misc';
import { createServiceInstanceKey } from '../../../../../utils/service_instance';
import { useToastStyle } from '../../../../../hooks';
import { emit } from '@tauri-apps/api/event';

export default function SelectPluginModal(props) {
    const { isOpen, onOpenChange, setCurrentConfigKey, onConfigOpen, pluginType, pluginList, deleteService } = props;
    const [installing, setInstalling] = useState(false);
    const { t } = useTranslation();
    const toastStyle = useToastStyle();

    return (
        <>
            {isOpen && <Toaster />}
            <Dialog
                open={isOpen}
                onOpenChange={onOpenChange}
            >
                <DialogContent className='grid-cols-[minmax(0,1fr)] sm:max-w-[460px]'>
                    <DialogHeader>
                        <DialogTitle>{t('config.service.add_plugin_title')}</DialogTitle>
                        <DialogDescription>{t('config.service.add_plugin_desc')}</DialogDescription>
                    </DialogHeader>
                    {Object.keys(pluginList).length > 0 && (
                        <div className='flex max-h-[40vh] flex-col gap-2 overflow-y-auto'>
                            {Object.keys(pluginList).map((x) => {
                                return (
                                    <div
                                        className='flex min-h-11 items-center gap-3 rounded-lg border py-1 pl-3 pr-1.5'
                                        key={x}
                                    >
                                        {pluginList[x].icon ? (
                                            <img
                                                src={pluginList[x].icon}
                                                className='size-5 shrink-0'
                                                draggable={false}
                                            />
                                        ) : (
                                            <Package className='size-5 shrink-0 text-muted-foreground' />
                                        )}
                                        <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                                            {pluginList[x].display}
                                        </span>
                                        <Button
                                            variant='ghost'
                                            size='sm'
                                            onClick={() => {
                                                setCurrentConfigKey(createServiceInstanceKey(x));
                                                onConfigOpen();
                                            }}
                                        >
                                            <Plus />
                                            {t('config.service.add')}
                                        </Button>
                                        <Button
                                            variant='ghost'
                                            size='icon-sm'
                                            className='text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20'
                                            aria-label={t('common.delete')}
                                            title={t('common.delete')}
                                            onClick={() => {
                                                removeDir(`plugins/${pluginType}/${x}`, {
                                                    dir: BaseDirectory.AppConfig,
                                                    recursive: true,
                                                }).then(
                                                    (v) => {
                                                        toast.success(t('config.service.uninstall_success'), {
                                                            style: toastStyle,
                                                        });
                                                        deleteService(x);
                                                        emit('reload_plugin_list');
                                                    },
                                                    (e) => {
                                                        toast.error(e.toString(), { style: toastStyle });
                                                    }
                                                );
                                            }}
                                        >
                                            <Trash2 />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <div className='grid grid-cols-2 gap-3'>
                        <Button
                            variant='secondary'
                            disabled={installing}
                            onClick={async () => {
                                setInstalling(true);
                                const selected = await open({
                                    multiple: true,
                                    directory: false,
                                    filters: [
                                        {
                                            name: '*.potext',
                                            extensions: ['potext'],
                                        },
                                    ],
                                });
                                if (selected !== null) {
                                    invoke('install_plugin', {
                                        pathList: selected,
                                    }).then(
                                        (count) => {
                                            setInstalling(false);
                                            toast.success('Installed ' + count + ' plugins', {
                                                style: toastStyle,
                                            });
                                            emit('reload_plugin_list');
                                        },
                                        (e) => {
                                            setInstalling(false);
                                            toast.error(e.toString(), { style: toastStyle });
                                        }
                                    );
                                } else {
                                    setInstalling(false);
                                }
                            }}
                        >
                            {installing ? <Spinner /> : <Upload />}
                            {t('config.service.install_plugin')}
                        </Button>
                    </div>
                    <DialogFooter>
                        <Button
                            variant='outline'
                            onClick={() => {
                                onOpenChange(false);
                            }}
                        >
                            {t('common.cancel')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
