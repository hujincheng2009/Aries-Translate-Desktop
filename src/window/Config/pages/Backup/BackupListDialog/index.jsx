import { FileText, Trash2 } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton, Spinner } from '@/components/ui/misc';

// Shared UI of the WebDAV backup list dialog. The parents own the data and the restore / delete logic.
// `files` is an array of file names; `downloading[i]` marks the file that is being restored.
export default function BackupListDialog({
    isOpen,
    onOpenChange,
    loading,
    files = [],
    downloading = [],
    onRestore,
    onDelete,
}) {
    const { t } = useTranslation();
    // File waiting for delete confirmation: { file, index } or null
    const [pendingDelete, setPendingDelete] = useState(null);

    return (
        <>
            <Dialog
                open={isOpen}
                onOpenChange={onOpenChange}
            >
                <DialogContent className='grid-cols-[minmax(0,1fr)] sm:max-w-[480px]'>
                    <DialogHeader>
                        <DialogTitle>{t('config.backup.list')}</DialogTitle>
                        <DialogDescription>{t('config.backup.list_desc')}</DialogDescription>
                    </DialogHeader>
                    {loading ? (
                        <div className='flex flex-col gap-2'>
                            <Skeleton className='h-12 w-full rounded-lg' />
                            <Skeleton className='h-12 w-full rounded-lg' />
                            <Skeleton className='h-12 w-full rounded-lg' />
                        </div>
                    ) : (files ?? []).length === 0 ? (
                        <p className='py-6 text-center text-sm text-muted-foreground'>{t('config.backup.empty')}</p>
                    ) : (
                        <div className='flex max-h-[50vh] flex-col gap-2 overflow-y-auto'>
                            {(files ?? []).map((file, index) => (
                                <div
                                    key={file.path ?? file}
                                    className='flex min-h-12 items-center gap-3 rounded-lg border py-1.5 pl-3 pr-1.5'
                                >
                                    <FileText className='size-5 shrink-0 text-muted-foreground' />
                                    <span
                                        className='min-w-0 flex-1 truncate text-sm font-medium'
                                        title={file.name ?? file}
                                    >
                                        {file.name ?? file}
                                        {file.legacy && (
                                            <span className='ml-2 text-xs text-muted-foreground'>
                                                {t('config.backup.legacy')}
                                            </span>
                                        )}
                                    </span>
                                    <Button
                                        variant='outline'
                                        size='sm'
                                        disabled={!!downloading[index]}
                                        onClick={() => {
                                            onRestore(file, index);
                                        }}
                                    >
                                        {downloading[index] && <Spinner />}
                                        {t('config.backup.restore_item')}
                                    </Button>
                                    <Button
                                        variant='ghost'
                                        size='icon-sm'
                                        className='text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20'
                                        aria-label={t('common.delete')}
                                        title={t('common.delete')}
                                        onClick={() => {
                                            setPendingDelete({ file, index });
                                        }}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => {
                    if (!open) setPendingDelete(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('config.backup.delete_title')}</AlertDialogTitle>
                        <AlertDialogDescription className='break-all'>
                            {t('config.backup.delete_desc', {
                                name: pendingDelete?.file?.name ?? pendingDelete?.file ?? '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            variant='destructive'
                            onClick={() => {
                                if (pendingDelete) {
                                    onDelete(pendingDelete.file, pendingDelete.index);
                                }
                                setPendingDelete(null);
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
