import React, { useId } from 'react';

import { cn } from '@/lib/utils';

// One row inside a SettingsSection card: title (+ description) on the left, the control on the right.
export default function SettingRow({ title, description, children, className }) {
    const titleId = useId();
    // Name a single control (switch, input, ...) after the row title unless it already has its own label.
    const control = React.isValidElement(children)
        ? React.cloneElement(children, { 'aria-labelledby': titleId, ...children.props })
        : children;
    return (
        <div
            role='group'
            aria-labelledby={titleId}
            className={cn('flex items-center justify-between gap-4 border-b px-4 py-3.5 last:border-b-0', className)}
        >
            <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <div
                    id={titleId}
                    className='text-sm font-medium leading-5'
                >
                    {title}
                </div>
                {description && <div className='text-sm leading-5 text-muted-foreground'>{description}</div>}
            </div>
            {children !== undefined && children !== null && (
                <div className='flex shrink-0 items-center justify-end'>{control}</div>
            )}
        </div>
    );
}

// Free-form area inside a SettingsSection card (for example labeled inputs below a switch row).
export function SettingFields({ children, className }) {
    return <div className={cn('flex flex-col gap-4 border-b p-4 last:border-b-0', className)}>{children}</div>;
}
