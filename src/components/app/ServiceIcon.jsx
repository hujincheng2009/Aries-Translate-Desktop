import React from 'react';
import { cn } from '@/lib/utils';

// Monochrome is service metadata, never inferred from the URL or applied to other providers/plugins.
export default function ServiceIcon({ iconMonochrome = false, className, alt = '', ...props }) {
    return (
        <img
            {...props}
            alt={alt}
            className={cn('object-contain', iconMonochrome && 'dark:invert', className)}
            draggable={false}
        />
    );
}
