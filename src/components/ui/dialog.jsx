import * as DialogPrimitive from '@radix-ui/react-dialog';
import { XIcon } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        data-slot='dialog-overlay'
        className={cn(
            'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
        )}
        {...props}
    />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef(({ className, children, showCloseButton = true, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        {/* Centered with inset-0 + m-auto instead of a -50% translate: an odd height would put the
            dialog (and its text) on a half pixel and blur it, and the enter/exit keyframes would replace
            that translate mid-animation. Opening fades in while rising 10px into place; closing reverses it. */}
        <DialogPrimitive.Content
            ref={ref}
            data-slot='dialog-content'
            className={cn(
                'fixed inset-0 z-50 m-auto grid h-fit max-h-[calc(100%-2rem)] w-full max-w-[calc(100%-2rem)] gap-4 overflow-y-auto rounded-xl border bg-background p-6 shadow-lg duration-200 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-[10px] data-[state=closed]:slide-out-to-bottom-[10px] sm:max-w-md',
                className
            )}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close
                    data-slot='dialog-close'
                    className="absolute right-4 top-4 rounded-sm opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
                >
                    <XIcon />
                    <span className='sr-only'>Close</span>
                </DialogPrimitive.Close>
            )}
        </DialogPrimitive.Content>
    </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }) {
    return (
        <div
            data-slot='dialog-header'
            className={cn('flex flex-col gap-1.5 pr-6 text-left', className)}
            {...props}
        />
    );
}

function DialogFooter({ className, ...props }) {
    return (
        <div
            data-slot='dialog-footer'
            className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
            {...props}
        />
    );
}

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        data-slot='dialog-title'
        className={cn('flex items-center gap-2 text-lg font-semibold leading-none', className)}
        {...props}
    />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        data-slot='dialog-description'
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
    />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
