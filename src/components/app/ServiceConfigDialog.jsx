import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert } from '@/components/ui/alert';
import ServiceGuideCallout from './ServiceGuideCallout';
import ServiceIcon from './ServiceIcon';
import { getServiceMeta } from '@/services/service_meta';
import { explainServiceError, redactServiceError } from '@/utils/service_error';
import { requiredServiceFields } from '@/utils/service_form';

// Lets a form inside the dialog (see ConfigFooter in ServiceConfigForm) close the dialog and tell the shell that the
// form renders its own footer, so the shell's cancel footer is not shown twice.
const ServiceConfigDialogContext = createContext({
    close: undefined,
    registerFooter: () => () => {},
    reportError: () => {},
    requiredFields: [],
    missingFields: [],
    setRequiredField: () => {},
    removeRequiredField: () => {},
    fieldError: null,
    clearFailure: () => {},
});

export function useServiceConfigDialog() {
    return useContext(ServiceConfigDialogContext);
}

// Shell of the service configuration dialog: header (icon + title + plugin badge), scrolling body, cancel footer.
// `children` is a function `(onClose) => form` so the form can close the dialog after saving.
// `hideFooter` removes the shell's cancel footer for forms that render their own (ConfigFooter); a mounted
// ConfigFooter hides it automatically too.
export default function ServiceConfigDialog({
    isOpen,
    onOpenChange,
    icon,
    iconMonochrome = false,
    title,
    serviceName,
    serviceType,
    isPlugin = false,
    hideFooter = false,
    children,
}) {
    const { t } = useTranslation();
    const onClose = () => onOpenChange(false);
    const [formFooters, setFormFooters] = useState(0);
    const [failure, setFailure] = useState(null);
    const [fields, setFields] = useState({});
    const requiredFields = useMemo(
        () => (isPlugin ? [] : requiredServiceFields(serviceName, serviceType)),
        [serviceName, serviceType, isPlugin]
    );
    const missingFields = useMemo(
        () =>
            Object.values(fields)
                .filter((field) => field.missing)
                .map((field) => field.label),
        [fields]
    );
    const setRequiredField = useCallback(
        (id, label, missing) =>
            setFields((previous) => {
                if (previous[id]?.label === label && previous[id]?.missing === missing) return previous;
                return { ...previous, [id]: { label, missing } };
            }),
        []
    );
    const removeRequiredField = useCallback(
        (id) =>
            setFields((previous) => {
                if (!(id in previous)) return previous;
                const next = { ...previous };
                delete next[id];
                return next;
            }),
        []
    );
    const failureRef = useRef(null);
    useEffect(() => {
        // A located error scrolls to its field instead (ConfigField).
        if (failure && !failure.fieldKey) failureRef.current?.scrollIntoView({ block: 'nearest' });
    }, [failure]);
    useEffect(() => {
        setFailure(null);
    }, [isOpen, serviceName]);
    const provider = isPlugin ? undefined : getServiceMeta(serviceName, serviceType)?.provider;
    const reportError = useCallback(
        (error, config) => {
            setFailure({ ...explainServiceError(error, provider), detail: redactServiceError(error, config) });
        },
        [provider]
    );
    const clearFailure = useCallback(() => setFailure(null), []);
    const fieldError = useMemo(
        () => (failure?.fieldKey ? { fieldKey: failure.fieldKey, kind: failure.kind, ...failure.values } : null),
        [failure]
    );
    const registerFooter = useCallback(() => {
        setFormFooters((count) => count + 1);
        return () => setFormFooters((count) => count - 1);
    }, []);
    const context = useMemo(
        () => ({
            close: () => onOpenChange(false),
            registerFooter,
            reportError,
            requiredFields,
            missingFields,
            setRequiredField,
            removeRequiredField,
            fieldError,
            clearFailure,
        }),
        [
            onOpenChange,
            registerFooter,
            reportError,
            requiredFields,
            missingFields,
            setRequiredField,
            removeRequiredField,
            fieldError,
            clearFailure,
        ]
    );
    const showFooter = !hideFooter && formFooters === 0;

    return (
        <Dialog
            open={isOpen}
            onOpenChange={onOpenChange}
        >
            <DialogContent
                className='flex flex-col gap-0 overflow-hidden sm:max-w-[30rem]'
                aria-describedby={undefined}
            >
                <DialogHeader className='pb-4'>
                    <DialogTitle className='text-base'>
                        {icon ? (
                            <ServiceIcon
                                src={icon}
                                iconMonochrome={iconMonochrome}
                                className='size-5 shrink-0'
                                draggable={false}
                            />
                        ) : (
                            <Package className='size-5 shrink-0 text-muted-foreground' />
                        )}
                        <span className='min-w-0 truncate'>{title}</span>
                        {isPlugin && <Badge variant='outline'>{t('common.plugin')}</Badge>}
                    </DialogTitle>
                </DialogHeader>
                <ServiceConfigDialogContext.Provider value={context}>
                    <div className='-mx-6 max-h-[75vh] min-h-0 flex-1 overflow-y-auto px-6'>
                        {!isPlugin && (
                            <ServiceGuideCallout
                                key={serviceName}
                                serviceName={serviceName}
                                serviceType={serviceType}
                            />
                        )}
                        {failure && (
                            <div ref={failureRef}>
                                <Alert
                                    variant='destructive'
                                    className='mb-4 block space-y-2 text-sm'
                                    role='alert'
                                >
                                    <p>
                                        {t(failure.messageKey, failure.values)} {t(failure.adviceKey, failure.values)}
                                    </p>
                                    <details>
                                        <summary className='cursor-pointer'>{t('services.errors.details')}</summary>
                                        <pre className='mt-2 whitespace-pre-wrap break-all font-mono text-xs'>
                                            {failure.detail}
                                        </pre>
                                    </details>
                                </Alert>
                            </div>
                        )}
                        {children(onClose)}
                    </div>
                </ServiceConfigDialogContext.Provider>
                {showFooter && (
                    <DialogFooter className='pt-4'>
                        <Button
                            variant='outline'
                            onClick={onClose}
                        >
                            {t('common.cancel')}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
