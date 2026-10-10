import React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// A titled group of settings: heading + optional description, then a card that holds SettingRow children.
export default function SettingsSection({ title, description, children, className }) {
    return (
        <section className={cn('flex flex-col gap-3', className)}>
            {(title || description) && (
                <div className='flex flex-col gap-0.5'>
                    {title && <h3 className='text-base font-medium leading-6'>{title}</h3>}
                    {description && <p className='text-sm leading-5 text-muted-foreground'>{description}</p>}
                </div>
            )}
            <Card className='gap-0 py-0'>{children}</Card>
        </section>
    );
}
