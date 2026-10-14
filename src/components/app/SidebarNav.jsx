import { Cloud, History, Info, Keyboard, Languages, Puzzle, ScanText, Settings, TextSelect } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { osType, appVersion } from '../../utils/env';
import { cn } from '@/lib/utils';
import WindowDragRegion from './WindowDragRegion';

const groups = [
    {
        labelKey: 'config.sidebar.settings',
        items: [
            { path: '/general', labelKey: 'config.general.label', icon: Settings },
            { path: '/translate', labelKey: 'config.translate.label', icon: Languages },
            // The selection assistant is Windows only
            { path: '/selection', labelKey: 'config.selection.label', icon: TextSelect, os: 'Windows_NT' },
            { path: '/recognize', labelKey: 'config.recognize.label', icon: ScanText },
            { path: '/hotkey', labelKey: 'config.hotkey.label', icon: Keyboard },
            { path: '/service', labelKey: 'config.service.label', icon: Puzzle },
        ],
    },
    {
        labelKey: 'config.sidebar.data',
        items: [
            { path: '/history', labelKey: 'config.history.label', icon: History },
            { path: '/backup', labelKey: 'config.backup.label', icon: Cloud },
        ],
    },
];

const about = { path: '/about', labelKey: 'config.about.label', icon: Info };

function NavItem({ item }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const active = location.pathname.includes(item.path);
    const Icon = item.icon;

    return (
        <button
            type='button'
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.path)}
            className={cn(
                'flex h-8 w-full shrink-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            )}
        >
            <Icon className='size-4 shrink-0' />
            <span className='truncate'>{t(item.labelKey)}</span>
        </button>
    );
}

// Sidebar content: app block, grouped menu items, and "About" pinned at the bottom.
export default function SidebarNav() {
    const { t } = useTranslation();

    return (
        <>
            <div
                className={cn(
                    'relative isolate flex shrink-0 items-center gap-2.5 px-4 pb-4 pt-4',
                    osType === 'Darwin' && 'pt-9'
                )}
            >
                <WindowDragRegion />
                <img
                    alt=''
                    src='/icon.svg'
                    className='pointer-events-none size-8 shrink-0'
                    draggable={false}
                />
                <div className='pointer-events-none flex min-w-0 flex-col'>
                    <span className='truncate text-sm font-semibold leading-5'>{t('common.app_name')}</span>
                    <span
                        title={appVersion}
                        className='truncate text-xs leading-4 text-muted-foreground'
                    >
                        {appVersion}
                    </span>
                </div>
            </div>
            <nav className='flex min-h-0 flex-1 flex-col px-2 pb-3'>
                <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto'>
                    {groups.map((group) => (
                        <div
                            key={group.labelKey}
                            className='flex flex-col gap-1'
                        >
                            <div className='-mb-1 flex h-8 shrink-0 items-center px-2 text-xs font-medium text-muted-foreground'>
                                {t(group.labelKey)}
                            </div>
                            {group.items
                                .filter((item) => !item.os || item.os === osType)
                                .map((item) => (
                                    <NavItem
                                        key={item.path}
                                        item={item}
                                    />
                                ))}
                        </div>
                    ))}
                </div>
                <NavItem item={about} />
            </nav>
        </>
    );
}
