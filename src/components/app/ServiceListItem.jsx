import { GripVertical, Package, SquarePen, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ServiceTags from './ServiceTags';
import ServiceIcon from './ServiceIcon';

// One row of the service lists (translate / recognize / tts / collection).
// - dragHandleProps: react-beautiful-dnd `dragHandleProps`, spread on the grip handle
// - actions: extra controls shown before the edit / delete buttons (for example the enable switch)
// - beforeDelete: optional guard run when the trash button is pressed; return false to stop (it shows its own toast)
// - onDelete: runs only after the user confirms the delete dialog
export default function ServiceListItem({
    name,
    serviceName,
    serviceType,
    icon,
    iconMonochrome = false,
    isPlugin = false,
    removed = false,
    dragHandleProps,
    actions,
    onEdit,
    beforeDelete,
    onDelete,
}) {
    const { t } = useTranslation();
    const [confirmOpen, setConfirmOpen] = useState(false);

    return (
        <>
            {/* The controls wrap below the name when the row is too narrow (large font size, small window) */}
            <div
                className={`flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-card px-4 py-2.5 shadow-xs ${removed ? 'text-muted-foreground' : 'text-card-foreground'}`}
            >
                <div className='flex min-w-0 flex-1 basis-40 items-center gap-3'>
                    <div
                        {...dragHandleProps}
                        className='flex shrink-0 cursor-grab items-center text-muted-foreground'
                    >
                        <GripVertical className='size-4' />
                    </div>
                    {icon ? (
                        <ServiceIcon
                            src={icon}
                            iconMonochrome={iconMonochrome}
                            className='size-6 shrink-0'
                            draggable={false}
                        />
                    ) : (
                        <Package className='size-6 shrink-0 text-muted-foreground' />
                    )}
                    <span
                        className='min-w-0 flex-1 truncate text-sm font-medium'
                        title={name}
                    >
                        {name}
                    </span>
                    {isPlugin && (
                        <Badge
                            variant='outline'
                            className='shrink-0'
                        >
                            {t('common.plugin')}
                        </Badge>
                    )}
                    {!isPlugin && !removed && (
                        <ServiceTags
                            serviceName={serviceName}
                            serviceType={serviceType}
                        />
                    )}
                    {removed && <Badge variant='secondary'>{t('config.service.removed')}</Badge>}
                </div>
                <div className='ml-auto flex shrink-0 items-center gap-3'>
                    {!removed && actions}
                    <div className='flex items-center gap-1'>
                        {!removed && (
                            <Button
                                variant='ghost'
                                size='icon-sm'
                                aria-label={t('config.service.edit')}
                                title={t('config.service.edit')}
                                onClick={onEdit}
                            >
                                <SquarePen />
                            </Button>
                        )}
                        <Button
                            variant='ghost'
                            size='icon-sm'
                            className='text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20'
                            aria-label={t('common.delete')}
                            title={t('common.delete')}
                            onClick={() => {
                                if (beforeDelete && !beforeDelete()) return;
                                setConfirmOpen(true);
                            }}
                        >
                            <Trash2 />
                        </Button>
                    </div>
                </div>
            </div>
            <AlertDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className='break-all'>
                            {t('config.service.delete_title', { name })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>{t('config.service.delete_desc')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            variant='destructive'
                            onClick={() => {
                                setConfirmOpen(false);
                                onDelete();
                            }}
                        >
                            {t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
