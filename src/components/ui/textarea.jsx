import React from 'react';

import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
    return (
        <textarea
            ref={ref}
            data-slot='textarea'
            className={cn(
                'flex min-h-16 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive dark:bg-input/30',
                className
            )}
            {...props}
        />
    );
});
Textarea.displayName = 'Textarea';

export { Textarea };
