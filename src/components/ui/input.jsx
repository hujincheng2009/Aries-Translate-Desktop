import React from 'react';

import { cn } from '@/lib/utils';

// Vega: 36px high, 8px radius, 10px horizontal padding, white background in light mode
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
    return (
        <input
            ref={ref}
            type={type}
            data-slot='input'
            className={cn(
                'flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 dark:bg-input/30',
                className
            )}
            {...props}
        />
    );
});
Input.displayName = 'Input';

export { Input };
