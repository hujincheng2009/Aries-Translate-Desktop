import ServiceIcon from '@/components/app/ServiceIcon';
import { readDir, BaseDirectory, readTextFile, exists } from '@tauri-apps/api/fs';
import { ChevronLeft, ChevronRight, Search, Trash2 } from 'lucide-react';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/tauri';
import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Database from 'tauri-plugin-sql-api';

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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import * as builtinCollectionServices from '../../../../services/collection';
import { invoke_plugin } from '../../../../utils/invoke_plugin';
import * as builtinServices from '../../../../services/translate';
import { useConfig, useToastStyle } from '../../../../hooks';
import { store } from '../../../../utils/store';
import {
    ServiceSourceType,
    ServiceType,
    getServiceName,
    getServiceSouceType,
    whetherAvailableService,
} from '../../../../utils/service_instance';

const PAGE_SIZE = 20;

// Page numbers to show: everything for short lists, otherwise first / last / around the current page with gaps ('...').
function buildPageList(page, pageCount) {
    if (pageCount <= 7) {
        return Array.from({ length: pageCount }, (_, i) => i + 1);
    }
    const pages = new Set([1, pageCount, page - 1, page, page + 1]);
    if (page <= 3) {
        [2, 3, 4].forEach((p) => pages.add(p));
    }
    if (page >= pageCount - 2) {
        [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p));
    }
    const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
    const result = [];
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) {
            result.push(`gap-${p}`);
        }
        result.push(p);
    });
    return result;
}

export default function History() {
    const [collectionServiceList] = useConfig('collection_service_list', []);
    const [isOpen, setIsOpen] = useState(false);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
    const [pluginList, setPluginList] = useState(null);
    const [selectedItem, setSelectItem] = useState(null);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState([]);
    const [keyword, setKeyword] = useState('');
    const toastStyle = useToastStyle();
    const { t } = useTranslation();
    useEffect(() => {
        init();
        loadPluginList();
    }, []);

    useEffect(() => {
        getData();
    }, [total, page]);

    const init = async () => {
        const db = await Database.load('sqlite:history.db');
        const result = await db.select('SELECT COUNT(*) FROM history');
        if (result[0] && result[0]['COUNT(*)']) {
            setTotal(result[0]['COUNT(*)']);
        }
    };
    const getData = async () => {
        const db = await Database.load('sqlite:history.db');
        let result = await db.select('SELECT * FROM history ORDER BY id DESC LIMIT 20 OFFSET $1', [20 * (page - 1)]);
        setItems(result);
    };

    const getSelectedData = async (id) => {
        const db = await Database.load('sqlite:history.db');
        let result = await db.select('SELECT * FROM history WHERE id=$1', [id]);
        setSelectItem(result[0]);
    };
    const clearData = async () => {
        const db = await Database.load('sqlite:history.db');
        await db.execute('DROP TABLE history');
        await db.execute('VACUUM');
        setItems([]);
        setTotal(0);
        setPage(1);
    };
    const updateData = async () => {
        const db = await Database.load('sqlite:history.db');
        await db.execute('UPDATE history SET text=$1, result=$2 WHERE id=$3', [
            selectedItem.text,
            selectedItem.result,
            selectedItem.id,
        ]);
        await getData();
    };

    const formatDate = (date) => {
        function padTo2Digits(num) {
            return num.toString().padStart(2, '0');
        }
        const year = date.getFullYear().toString().slice(2, 4);
        const month = padTo2Digits(date.getMonth() + 1);
        const day = padTo2Digits(date.getDate());
        const hour = padTo2Digits(date.getHours());
        const minute = padTo2Digits(date.getMinutes());
        const second = padTo2Digits(date.getSeconds());
        return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
    };
    // Same layout as formatDate but with a four digit year (used in the detail dialog)
    const formatFullDate = (date) => `${date.getFullYear().toString().slice(0, 2)}${formatDate(date)}`;
    const loadPluginList = async () => {
        const serviceTypeList = ['translate', 'collection'];
        let temp = {};
        for (const serviceType of serviceTypeList) {
            temp[serviceType] = {};
            if (await exists(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig })) {
                const plugins = await readDir(`plugins/${serviceType}`, { dir: BaseDirectory.AppConfig });
                for (const plugin of plugins) {
                    const infoStr = await readTextFile(`plugins/${serviceType}/${plugin.name}/info.json`, {
                        dir: BaseDirectory.AppConfig,
                    });
                    let pluginInfo = JSON.parse(infoStr);
                    if ('icon' in pluginInfo) {
                        const appConfigDirPath = await appConfigDir();
                        const iconPath = await join(
                            appConfigDirPath,
                            `/plugins/${serviceType}/${plugin.name}/${pluginInfo.icon}`
                        );
                        pluginInfo.icon = convertFileSrc(iconPath);
                    }
                    temp[serviceType][plugin.name] = pluginInfo;
                }
            }
        }
        setPluginList({ ...temp });
    };

    // Name of the translate service a history row came from (built-in title or plugin display name)
    const getTranslateServiceTitle = (serviceKey) => {
        const name = getServiceName(serviceKey);
        if (getServiceSouceType(serviceKey) === ServiceSourceType.PLUGIN) {
            return `${pluginList['translate'][name]?.display ?? name} [${t('common.plugin')}]`;
        }
        return t(`services.translate.${name}.title`);
    };
    const getLanguageName = (code) => (code ? t(`languages.${code}`, { defaultValue: code }) : '');

    const isMonochromeService = (instanceKey) =>
        getServiceSouceType(instanceKey) !== ServiceSourceType.PLUGIN &&
        builtinServices[getServiceName(instanceKey)]?.info.iconMonochrome;
    const getServiceIcon = (serviceKey) =>
        getServiceSouceType(serviceKey) === ServiceSourceType.PLUGIN
            ? pluginList['translate'][getServiceName(serviceKey)].icon
            : `${builtinServices[getServiceName(serviceKey)].info.icon}`;

    // Rows of services that are no longer installed stay hidden; the search only looks at the loaded page.
    const query = keyword.trim().toLowerCase();
    const visibleItems =
        pluginList === null
            ? []
            : (items ?? [])
                  .filter((item) =>
                      whetherAvailableService(item.service, {
                          [ServiceSourceType.BUILDIN]: builtinServices,
                          [ServiceSourceType.PLUGIN]: pluginList[ServiceType.TRANSLATE],
                      })
                  )
                  .filter(
                      (item) =>
                          query === '' ||
                          String(item.text ?? '')
                              .toLowerCase()
                              .includes(query) ||
                          String(item.result ?? '')
                              .toLowerCase()
                              .includes(query)
                  );

    const openItem = (id) => {
        getSelectedData(id);
        setIsOpen(true);
    };

    const pageCount = Math.ceil(total / PAGE_SIZE);

    const addToCollection = async (instanceKey) => {
        if (getServiceSouceType(instanceKey) === ServiceSourceType.PLUGIN) {
            const pluginConfig = (await store.get(instanceKey)) ?? {};
            let [func, utils] = await invoke_plugin('collection', getServiceName(instanceKey));
            func(selectedItem.text, selectedItem.result, {
                config: pluginConfig,
                utils,
            }).then(
                (_) => {
                    toast.success(t('translate.add_collection_success'), {
                        style: toastStyle,
                    });
                },
                (e) => {
                    toast.error(e.toString(), {
                        style: toastStyle,
                    });
                }
            );
        } else {
            const instanceConfig = (await store.get(instanceKey)) ?? {};
            builtinCollectionServices[getServiceName(instanceKey)]
                .collection(selectedItem.text, selectedItem.result, {
                    config: instanceConfig,
                })
                .then(
                    (_) => {
                        toast.success(t('translate.add_collection_success'), {
                            style: toastStyle,
                        });
                    },
                    (e) => {
                        toast.error(e.toString(), {
                            style: toastStyle,
                        });
                    }
                );
        }
    };

    return (
        pluginList !== null && (
            <>
                <Toaster />
                <div className='flex flex-col gap-4'>
                    <div className='flex items-center gap-2'>
                        <div className='relative min-w-0 flex-1'>
                            <Search className='pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                            <Input
                                className='pl-8'
                                value={keyword}
                                placeholder={t('config.history.search_placeholder')}
                                aria-label={t('config.history.search_placeholder')}
                                onChange={(e) => {
                                    setKeyword(e.target.value);
                                }}
                            />
                        </div>
                        <Button
                            variant='outline'
                            className='text-destructive hover:text-destructive'
                            onClick={() => {
                                setClearConfirmOpen(true);
                            }}
                        >
                            <Trash2 />
                            {t('config.history.clear_all')}
                        </Button>
                    </div>
                    <div className='overflow-hidden rounded-xl border bg-card shadow-xs'>
                        <Table className='table-fixed'>
                            <colgroup>
                                <col className='w-[2.75rem]' />
                                <col />
                                {/* language column only when the window is wide; the detail dialog shows it too */}
                                <col className='hidden w-[8rem] lg:table-column' />
                                <col />
                                <col className='w-[9rem]' />
                            </colgroup>
                            <TableHeader>
                                <TableRow className='hover:bg-transparent'>
                                    <TableHead className='px-3' />
                                    <TableHead className='truncate px-3'>{t('config.history.col_text')}</TableHead>
                                    <TableHead className='hidden truncate px-3 lg:table-cell'>
                                        {t('config.history.col_language')}
                                    </TableHead>
                                    <TableHead className='truncate px-3'>{t('config.history.col_result')}</TableHead>
                                    <TableHead className='truncate px-3'>{t('config.history.col_time')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleItems.length === 0 ? (
                                    <TableRow className='hover:bg-transparent'>
                                        <TableCell
                                            colSpan={5}
                                            className='py-12 text-center text-sm text-muted-foreground'
                                        >
                                            {(items ?? []).length === 0
                                                ? t('config.history.empty')
                                                : t('config.history.no_match')}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    visibleItems.map((item) => (
                                        <TableRow
                                            key={item.id}
                                            tabIndex={0}
                                            className='cursor-pointer outline-none focus-visible:bg-muted/50'
                                            onClick={() => {
                                                openItem(item.id);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    openItem(item.id);
                                                }
                                            }}
                                        >
                                            <TableCell className='px-3 py-2.5'>
                                                <ServiceIcon
                                                    src={getServiceIcon(item.service)}
                                                    iconMonochrome={isMonochromeService(item.service)}
                                                    className='size-5'
                                                    draggable={false}
                                                />
                                            </TableCell>
                                            <TableCell className='px-3 py-2.5'>
                                                <div
                                                    className='truncate'
                                                    title={item.text}
                                                >
                                                    {item.text}
                                                </div>
                                            </TableCell>
                                            <TableCell className='hidden px-3 py-2.5 lg:table-cell'>
                                                <div
                                                    className='truncate text-[13px] text-muted-foreground'
                                                    title={`${getLanguageName(item.source)} → ${getLanguageName(item.target)}`}
                                                >
                                                    {getLanguageName(item.source)} → {getLanguageName(item.target)}
                                                </div>
                                            </TableCell>
                                            <TableCell className='px-3 py-2.5'>
                                                <div
                                                    className='truncate'
                                                    title={item.result}
                                                >
                                                    {item.result}
                                                </div>
                                            </TableCell>
                                            <TableCell className='px-3 py-2.5'>
                                                <div className='truncate text-[13px] text-muted-foreground'>
                                                    {formatDate(new Date(item.timestamp))}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {total > 0 && (
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <span className='text-[13px] text-muted-foreground'>
                                {t('config.history.total', { total, size: PAGE_SIZE })}
                            </span>
                            {pageCount > 1 && (
                                <nav
                                    aria-label='pagination'
                                    className='flex max-w-full flex-wrap items-center gap-1'
                                >
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        disabled={page <= 1}
                                        onClick={() => {
                                            setPage(page - 1);
                                        }}
                                    >
                                        <ChevronLeft />
                                        {t('config.history.prev')}
                                    </Button>
                                    {buildPageList(page, pageCount).map((p) =>
                                        typeof p === 'number' ? (
                                            <Button
                                                key={p}
                                                variant={p === page ? 'outline' : 'ghost'}
                                                size='icon-sm'
                                                aria-current={p === page ? 'page' : undefined}
                                                onClick={() => {
                                                    setPage(p);
                                                }}
                                            >
                                                {p}
                                            </Button>
                                        ) : (
                                            <span
                                                key={p}
                                                className='flex size-8 items-center justify-center text-sm text-muted-foreground'
                                            >
                                                …
                                            </span>
                                        )
                                    )}
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        disabled={page >= pageCount}
                                        onClick={() => {
                                            setPage(page + 1);
                                        }}
                                    >
                                        {t('config.history.next')}
                                        <ChevronRight />
                                    </Button>
                                </nav>
                            )}
                        </div>
                    )}
                </div>

                <AlertDialog
                    open={clearConfirmOpen}
                    onOpenChange={setClearConfirmOpen}
                >
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>{t('config.history.clear_title')}</AlertDialogTitle>
                            <AlertDialogDescription>{t('config.history.clear_desc')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                                variant='destructive'
                                onClick={clearData}
                            >
                                {t('common.clear')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Dialog
                    open={isOpen}
                    onOpenChange={setIsOpen}
                >
                    <DialogContent className='grid-cols-[minmax(0,1fr)] sm:max-w-[480px]'>
                        {selectedItem ? (
                            <>
                                <DialogHeader>
                                    <DialogTitle className='min-w-0 gap-2'>
                                        <ServiceIcon
                                            src={getServiceIcon(selectedItem.service)}
                                            iconMonochrome={isMonochromeService(selectedItem.service)}
                                            className='size-5 shrink-0'
                                            draggable={false}
                                        />
                                        <span className='min-w-0 truncate'>
                                            {getTranslateServiceTitle(selectedItem.service)} ·{' '}
                                            {getLanguageName(selectedItem.source)} →{' '}
                                            {getLanguageName(selectedItem.target)}
                                        </span>
                                    </DialogTitle>
                                    <DialogDescription>
                                        {formatFullDate(new Date(selectedItem.timestamp))}
                                    </DialogDescription>
                                </DialogHeader>
                                <div className='flex flex-col gap-2'>
                                    <Label htmlFor='history-detail-text'>{t('config.history.col_text')}</Label>
                                    <Textarea
                                        id='history-detail-text'
                                        rows={3}
                                        value={selectedItem.text}
                                        onChange={(e) => {
                                            setSelectItem({ ...selectedItem, text: e.target.value });
                                        }}
                                    />
                                </div>
                                <div className='flex flex-col gap-2'>
                                    <Label htmlFor='history-detail-result'>{t('config.history.col_result')}</Label>
                                    <Textarea
                                        id='history-detail-result'
                                        rows={3}
                                        value={selectedItem.result}
                                        onChange={(e) => {
                                            setSelectItem({ ...selectedItem, result: e.target.value });
                                        }}
                                    />
                                </div>
                                <DialogFooter className='items-center sm:justify-between'>
                                    <div className='flex min-w-0 items-center gap-1'>
                                        {collectionServiceList && collectionServiceList.length > 0 && (
                                            <>
                                                <span className='mr-1 text-[13px] text-muted-foreground'>
                                                    {t('config.history.add_to_collection')}
                                                </span>
                                                {collectionServiceList.map((instanceKey) => {
                                                    return (
                                                        <Button
                                                            key={instanceKey}
                                                            variant='ghost'
                                                            size='icon-sm'
                                                            onClick={() => addToCollection(instanceKey)}
                                                        >
                                                            <img
                                                                src={
                                                                    getServiceSouceType(instanceKey) ===
                                                                    ServiceSourceType.PLUGIN
                                                                        ? pluginList['collection'][
                                                                              getServiceName(instanceKey)
                                                                          ].icon
                                                                        : builtinCollectionServices[
                                                                              getServiceName(instanceKey)
                                                                          ].info.icon
                                                                }
                                                                className='size-5'
                                                                draggable={false}
                                                            />
                                                        </Button>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                    <div className='flex justify-end gap-2'>
                                        <Button
                                            variant='outline'
                                            onClick={() => {
                                                setIsOpen(false);
                                            }}
                                        >
                                            {t('common.cancel')}
                                        </Button>
                                        <Button
                                            onClick={async () => {
                                                await updateData();
                                                setIsOpen(false);
                                            }}
                                        >
                                            {t('common.save')}
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </>
                        ) : (
                            <DialogHeader>
                                <DialogTitle className='sr-only'>{t('config.history.title')}</DialogTitle>
                            </DialogHeader>
                        )}
                    </DialogContent>
                </Dialog>
            </>
        )
    );
}
