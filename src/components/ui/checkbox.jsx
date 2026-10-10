import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

// 16px box with a 14px check, in px so the check stays centered at every app font size.
const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
        ref={ref}
        data-slot='checkbox'
        className={cn(
            'peer size-[16px] shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-input/30 dark:data-[state=checked]:bg-primary',
            className
        )}
        {...props}
    >
        <CheckboxPrimitive.Indicator className='flex items-center justify-center text-current transition-none'>
            <CheckIcon className='size-[14px]' />
        </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
