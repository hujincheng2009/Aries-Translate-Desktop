import React from 'react';

import { cn } from '@/lib/utils';

// Separate borders on the cells (not collapsed row borders): a collapsed 1px border is split half into each
// neighbouring row, which puts every cell's content, and its icons, on a half pixel.
function Table({ className, ...props }) {
    return (
        <div
            data-slot='table-container'
            className='relative w-full overflow-x-auto'
        >
            <table
                data-slot='table'
                className={cn('w-full caption-bottom border-separate border-spacing-0 text-sm', className)}
                {...props}
            />
        </div>
    );
}

function TableHeader({ className, ...props }) {
    return (
        <thead
            data-slot='table-header'
            className={cn('bg-muted/60 [&_th]:border-b', className)}
            {...props}
        />
    );
}

function TableBody({ className, ...props }) {
    return (
        <tbody
            data-slot='table-body'
            className={cn('[&_tr:last-child>td]:border-b-0', className)}
            {...props}
        />
    );
}

function TableRow({ className, ...props }) {
    return (
        <tr
            data-slot='table-row'
            className={cn('transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
            {...props}
        />
    );
}

function TableHead({ className, ...props }) {
    return (
        <th
            data-slot='table-head'
            className={cn(
                'h-10 whitespace-nowrap px-4 text-left align-middle text-[13px] font-medium text-muted-foreground',
                className
            )}
            {...props}
        />
    );
}

function TableCell({ className, ...props }) {
    return (
        <td
            data-slot='table-cell'
            className={cn('whitespace-nowrap border-b px-4 py-3 align-middle', className)}
            {...props}
        />
    );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
