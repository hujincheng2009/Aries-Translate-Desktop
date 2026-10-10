import * as LabelPrimitive from '@radix-ui/react-label';
import React from 'react';

import { cn } from '@/lib/utils';

const Label = React.forwardRef(({ className, ...props }, ref) => (
    <LabelPrimitive.Root
        ref={ref}
        data-slot='label'
        className={cn(
            'flex select-none items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            className
        )}
        {...props}
    />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
