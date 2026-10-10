import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import React from 'react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Overlay
        ref={ref}
        data-slot='alert-dialog-overlay'
        className={cn(
            'fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className
        )}
        {...props}
    />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => (
    <AlertDialogPortal>
        <AlertDialogOverlay />
        {/* Centered without a -50% translate so it stays on whole pixels (see dialog.jsx). */}
        <AlertDialogPrimitive.Content
            ref={ref}
            data-slot='alert-dialog-content'
            className={cn(
                'fixed inset-0 z-50 m-auto grid h-fit w-full max-w-[calc(100%-2rem)] gap-4 rounded-xl border bg-background p-6 shadow-lg duration-200 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-[10px] data-[state=closed]:slide-out-to-bottom-[10px] sm:max-w-sm',
                className
            )}
            {...props}
        />
    </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

function AlertDialogHeader({ className, ...props }) {
    return (
        <div
            data-slot='alert-dialog-header'
            className={cn('flex flex-col gap-1.5 text-left', className)}
            {...props}
        />
    );
}

function AlertDialogFooter({ className, ...props }) {
    return (
        <div
            data-slot='alert-dialog-footer'
            className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
            {...props}
        />
    );
}

const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Title
        ref={ref}
        data-slot='alert-dialog-title'
        className={cn('text-lg font-semibold', className)}
        {...props}
    />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Description
        ref={ref}
        data-slot='alert-dialog-description'
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
    />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

// variant="destructive" renders a solid red action, used for irreversible actions such as clearing history
const AlertDialogAction = React.forwardRef(({ className, variant = 'default', ...props }, ref) => (
    <AlertDialogPrimitive.Action
        ref={ref}
        className={cn(
            buttonVariants(),
            variant === 'destructive' && 'bg-destructive text-white hover:bg-destructive/90',
            className
        )}
        {...props}
    />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (
    <AlertDialogPrimitive.Cancel
        ref={ref}
        className={cn(buttonVariants({ variant: 'outline' }), className)}
        {...props}
    />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    AlertDialogPortal,
    AlertDialogTitle,
    AlertDialogTrigger,
};
