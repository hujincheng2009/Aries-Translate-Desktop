import { open } from '@tauri-apps/api/shell';
import { Eye, EyeOff, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React, { useId, useLayoutEffect, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/misc';
import { useServiceConfigDialog } from '@/components/app/ServiceConfigDialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { hasRequiredValue } from '@/utils/service_form';

// Building blocks for the forms rendered inside ServiceConfigDialog (translate / recognize / tts / collection).
// Layout follows the Figma service config dialog: fields stacked vertically, label above the control, hint below.

const HINT_CLASS = 'text-[0.8125rem] leading-snug text-muted-foreground';

// Vertical stack of fields. Pass `onSubmit` to render a <form>; without it a plain <div> is rendered
// (for forms that save through a button handler).
export function ConfigForm({ onSubmit, className, children, ...props }) {
    const { missingFields } = useServiceConfigDialog();
    const classes = cn('flex flex-col gap-4', className);
    if (onSubmit) {
        return (
            <form
                onSubmit={(event) => {
                    if (missingFields.length) {
                        event.preventDefault();
                        return;
                    }
                    onSubmit(event);
                }}
                className={classes}
                {...props}
            >
                {children}
            </form>
        );
    }
    return (
        <div
            className={classes}
            {...props}
        >
            {children}
        </div>
    );
}

// One field: label above, control (full width), optional hint below. A single element child receives the generated
// `id` (so the label is wired with htmlFor) and `aria-describedby` for the hint. `children` may also be a function
// `({ id, describedBy }) => node` for controls that need to place those themselves.
export function ConfigField({
    label,
    labelAction,
    hint,
    id,
    children,
    className,
    fieldKey,
    required: explicitRequired,
    value,
}) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = `${fieldId}-hint`;
    const describedBy = hint ? hintId : undefined;
    const { requiredFields, setRequiredField, removeRequiredField } = useServiceConfigDialog();
    const required = explicitRequired ?? requiredFields.includes(fieldKey);
    const fieldValue = value !== undefined ? value : React.isValidElement(children) ? children.props.value : undefined;
    const missing = !hasRequiredValue(fieldValue);
    useLayoutEffect(() => {
        if (required) setRequiredField(fieldId, label, missing);
        else removeRequiredField(fieldId);
    }, [required, fieldId, label, missing, setRequiredField, removeRequiredField]);
    useLayoutEffect(() => () => removeRequiredField(fieldId), [fieldId, removeRequiredField]);

    let control = children;
    if (typeof children === 'function') {
        control = children({ id: fieldId, describedBy });
    } else if (React.isValidElement(children) && typeof children.type !== 'string' && children.props.id === undefined) {
        control = React.cloneElement(children, {
            id: fieldId,
            'aria-describedby': describedBy,
            'aria-required': required || undefined,
        });
    }

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {label && (
                <div className='flex items-center justify-between gap-2'>
                    <Label htmlFor={fieldId}>
                        {label}
                        {required && (
                            <span
                                className='ml-1 text-destructive'
                                aria-hidden='true'
                            >
                                *
                            </span>
                        )}
                    </Label>
                    {labelAction}
                </div>
            )}
            {control}
            {hint && (
                <p
                    id={hintId}
                    className={HINT_CLASS}
                >
                    {hint}
                </p>
            )}
        </div>
    );
}

// Password input with a small ghost button inside on the right to show / hide the value.
export const SecretInput = React.forwardRef(({ className, ...props }, ref) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const label = visible ? t('common.hide_secret') : t('common.show_secret');

    return (
        <div className='relative'>
            <Input
                ref={ref}
                type={visible ? 'text' : 'password'}
                autoComplete='new-password'
                className={cn('pr-10', className)}
                {...props}
            />
            <Button
                type='button'
                variant='ghost'
                size='icon-xs'
                className='absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground'
                aria-label={label}
                title={label}
                aria-pressed={visible}
                onClick={() => setVisible((value) => !value)}
            >
                {visible ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
            </Button>
        </div>
    );
});
SecretInput.displayName = 'SecretInput';

// "Instance name" field that every service form starts with.
export function InstanceNameField({ value, onChange, disabled }) {
    const { t } = useTranslation();
    return (
        <ConfigField
            label={t('services.instance_name')}
            hint={t('services.instance_name_hint')}
        >
            <Input
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </ConfigField>
    );
}

// Row with the label on the left and an outline button with an external-link icon on the right.
// `url` is opened with the system browser (same as the old guide buttons).
export function ConfigGuide({ url, label, buttonText, onOpen }) {
    const { t } = useTranslation();
    const text = buttonText ?? t('services.view_guide');
    return (
        <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
            <span className='select-none text-sm font-medium leading-none'>{label ?? t('services.help')}</span>
            <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => (onOpen ? onOpen() : open(url))}
            >
                <ExternalLink />
                {text}
            </Button>
        </div>
    );
}

// Boolean option: label (+ hint) on the left, switch on the right.
export function ConfigSwitchRow({ label, hint, checked, onCheckedChange, disabled }) {
    const id = useId();
    return (
        <div className='flex items-center justify-between gap-4'>
            <div className='flex min-w-0 flex-col gap-1'>
                <Label
                    htmlFor={id}
                    className='leading-5'
                >
                    {label}
                </Label>
                {hint && <p className={HINT_CLASS}>{hint}</p>}
            </div>
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
            />
        </div>
    );
}

// Muted helper text (billing / privacy hints, "no configuration needed", ...).
export function ConfigNote({ children, className }) {
    return <p className={cn(HINT_CLASS, className)}>{children}</p>;
}

// Boxed notice. variant: 'default' (neutral) | 'destructive' (red text) | 'warning'.
export function ConfigCallout({ variant = 'default', className, children }) {
    return (
        <Alert
            variant={variant}
            className={cn('block px-3 py-2.5 text-[0.8125rem] leading-snug', className)}
        >
            {children}
        </Alert>
    );
}

// Inline external link (opens in a new window, like the old NextUI Link isExternal).
export function ConfigLink({ href, children, className }) {
    return (
        <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            className={cn('font-medium underline underline-offset-4 hover:opacity-80', className)}
        >
            {children}
        </a>
    );
}

// Editable list of role prompts (translate LLM services). `prompts` is [{ role, text }]; the form keeps owning the
// state shape and the role-assignment rules through the callbacks.
export function ConfigPromptList({ title = 'Prompt List', description, prompts, onChange, onDelete, onAdd, addLabel }) {
    return (
        <div className='flex flex-col gap-3'>
            <div className='flex flex-col gap-1'>
                <h3 className='text-sm font-medium leading-none'>{title}</h3>
                {description && <p className={HINT_CLASS}>{description}</p>}
            </div>
            {prompts.map((prompt, index) => (
                <PromptItem
                    key={index}
                    prompt={prompt}
                    onChange={(value) => onChange(index, value)}
                    onDelete={() => onDelete(index)}
                />
            ))}
            <Button
                type='button'
                variant='outline'
                onClick={onAdd}
            >
                <Plus />
                {addLabel}
            </Button>
        </div>
    );
}

function PromptItem({ prompt, onChange, onDelete }) {
    const { t } = useTranslation();
    const id = useId();
    return (
        <div className='flex flex-col gap-2'>
            <div className='flex items-center justify-between gap-2'>
                <Label htmlFor={id}>{prompt.role}</Label>
                <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    className='text-muted-foreground hover:text-destructive'
                    aria-label={t('common.delete')}
                    title={t('common.delete')}
                    onClick={onDelete}
                >
                    <Trash2 className='size-4' />
                </Button>
            </div>
            <Textarea
                id={id}
                value={prompt.text}
                placeholder={`Input Some ${prompt.role} Prompt`}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
    );
}

// Footer at the bottom of the form: optional extra actions on the left (`children`, e.g. a test button), then
// outline "cancel" and default "save" on the right. Pass `onSave` for a button handler; without it the save button
// submits the surrounding <form>. While `isLoading` the save button shows a spinner and is disabled.
// Sticks to the bottom of the dialog's scrolling body so it stays visible on long forms.
export function ConfigFooter({ onCancel, onSave, isLoading = false, disabled = false, saveText, children }) {
    const { t } = useTranslation();
    // Tells the dialog shell to drop its own cancel footer while this footer is mounted.
    const dialog = useServiceConfigDialog();
    const { registerFooter } = dialog;
    useLayoutEffect(() => registerFooter(), [registerFooter]);
    return (
        <div className='sticky bottom-0 z-10 -mx-6 flex flex-wrap items-center gap-2 bg-background px-6 pb-1 pt-4'>
            {dialog.missingFields.length > 0 && (
                <p
                    role='status'
                    className='w-full text-[0.8125rem] text-destructive'
                >
                    {t('services.form.missing', { fields: dialog.missingFields.join(', ') })}
                </p>
            )}
            {children && <div className='mr-auto flex items-center gap-2'>{children}</div>}
            <div className='ml-auto flex items-center gap-2'>
                <Button
                    type='button'
                    variant='outline'
                    onClick={onCancel ?? dialog.close}
                >
                    {t('common.cancel')}
                </Button>
                <Button
                    type={onSave ? 'button' : 'submit'}
                    onClick={onSave}
                    disabled={isLoading || disabled || dialog.missingFields.length > 0}
                >
                    {isLoading && <Spinner />}
                    {saveText ?? t('common.save')}
                </Button>
            </div>
        </div>
    );
}
