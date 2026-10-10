import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { useConfig } from '../../hooks';
import { osType } from '../../utils/env';
import { cn } from '@/lib/utils';
import SidebarNav from './SidebarNav';
import PageHeader from './PageHeader';

// Settings window frame: sidebar on the left, header + scrolling content on the right.
// Pages render SettingsSection blocks as children; they are stacked with a 32px gap.
export default function ConfigShell({ children }) {
    const [transparent] = useConfig('transparent', true);
    const { t } = useTranslation();
    const location = useLocation();

    return (
        <div
            className={cn(
                'flex h-screen w-screen cursor-default select-none overflow-hidden bg-background text-foreground',
                osType === 'Linux' && 'rounded-[10px] border'
            )}
        >
            <aside
                className={cn(
                    'flex w-[232px] shrink-0 flex-col border-r border-sidebar-border text-sidebar-foreground',
                    transparent ? 'bg-sidebar/90' : 'bg-sidebar'
                )}
            >
                <SidebarNav />
            </aside>
            <div className='flex min-w-0 flex-1 flex-col bg-background'>
                <PageHeader title={t(`config.${location.pathname.slice(1)}.title`)} />
                {/* window-scroll keeps the scrollbar out of the native resize band; its 8px gap plus pr-4 match the 24px left padding */}
                <main className='window-scroll min-h-0 flex-1 overflow-y-auto py-6 pl-6 pr-4'>
                    {/* Cap the reading width so labels and controls stay close when the window is wide or maximized */}
                    <div className='mx-auto flex w-full max-w-3xl flex-col gap-8'>{children}</div>
                </main>
            </div>
        </div>
    );
}
