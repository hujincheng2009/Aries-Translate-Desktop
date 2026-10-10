import React from 'react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Dropdown for a setting row. `options` is [{ value, label }]; the trigger shows `label` for the current value.
// `id`, `disabled`, `className` (trigger) and `aria-describedby` are optional (used by service config forms, where
// the trigger fills the field width and is labelled through htmlFor).
export default function OptionSelect({
    value,
    label,
    options,
    onChange,
    ariaLabel,
    'aria-labelledby': labelledBy,
    'aria-describedby': describedBy,
    'aria-required': required,
    id,
    disabled,
    className,
}) {
    return (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled}
        >
            <SelectTrigger
                id={id}
                className={className}
                aria-label={ariaLabel}
                aria-labelledby={labelledBy}
                aria-describedby={describedBy}
                aria-required={required}
            >
                <SelectValue>{label}</SelectValue>
            </SelectTrigger>
            <SelectContent className='max-h-[50vh]'>
                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                    >
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
