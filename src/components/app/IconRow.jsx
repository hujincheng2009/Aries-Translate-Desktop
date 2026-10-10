import React from 'react';

import { cn } from '@/lib/utils';

// A row for link-style lists: leading icon, title + muted description, action buttons on the right.
// Rows are separated by a bottom border (except the last one) and wrap their actions when space runs out.
export default function IconRow({ icon, title, description, children, className }) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3.5 last:border-b-0',
                className
            )}
        >
            <div className='flex min-w-0 flex-1 basis-40 items-center gap-3'>
                <span className='flex shrink-0 text-muted-foreground [&_svg:not([class*="size-"])]:size-[1.125rem]'>
                    {icon}
                </span>
                <div className='flex min-w-0 flex-col gap-0.5'>
                    <div className='text-sm font-medium leading-5'>{title}</div>
                    {description && (
                        <div className='break-words text-sm leading-5 text-muted-foreground'>{description}</div>
                    )}
                </div>
            </div>
            <div className='ml-auto flex flex-wrap items-center justify-end gap-2'>{children}</div>
        </div>
    );
}
