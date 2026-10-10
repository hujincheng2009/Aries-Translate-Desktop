import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { open } from '@tauri-apps/api/shell';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/misc';
import { loadServiceGuide } from '@/services/guides';

export default function ServiceGuideDialog({ provider, isOpen, onOpenChange }) {
    const { t, i18n } = useTranslation();
    const [content, setContent] = useState(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!isOpen) return;
        let active = true;
        setContent(null);
        setFailed(false);
        loadServiceGuide(provider, i18n.resolvedLanguage ?? i18n.language).then(
            (value) => active && setContent(value),
            () => active && setFailed(true)
        );
        return () => {
            active = false;
        };
    }, [isOpen, provider, i18n.resolvedLanguage, i18n.language]);
    return (
        <Dialog
            open={isOpen}
            onOpenChange={onOpenChange}
        >
            <DialogContent
                className='flex max-h-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-3xl'
                aria-describedby={undefined}
            >
                <DialogHeader>
                    <DialogTitle>{t('services.guide.title')}</DialogTitle>
                </DialogHeader>
                <div
                    className='min-h-0 overflow-y-auto text-sm leading-6 text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring'
                    role='region'
                    aria-label={t('services.guide.title')}
                    tabIndex={0}
                >
                    {failed ? (
                        <p>{t('services.guide.load_failed')}</p>
                    ) : content === null ? (
                        <Spinner />
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children }) => <h1 className='mb-4 text-xl font-semibold'>{children}</h1>,
                                h2: ({ children }) => <h2 className='mb-2 mt-6 text-base font-semibold'>{children}</h2>,
                                h3: ({ children }) => <h3 className='mb-2 mt-4 font-semibold'>{children}</h3>,
                                p: ({ children }) => <p className='my-2'>{children}</p>,
                                ul: ({ children }) => <ul className='my-2 list-disc space-y-1 pl-6'>{children}</ul>,
                                ol: ({ children }) => <ol className='my-2 list-decimal space-y-1 pl-6'>{children}</ol>,
                                table: ({ children }) => (
                                    <div className='my-3 overflow-x-auto'>
                                        <table className='w-full border-separate border-spacing-0 text-left'>
                                            {children}
                                        </table>
                                    </div>
                                ),
                                th: ({ children }) => (
                                    <th className='border-b bg-muted px-3 py-2 font-medium'>{children}</th>
                                ),
                                td: ({ children }) => <td className='border-b px-3 py-2 align-top'>{children}</td>,
                                code: ({ children }) => (
                                    <code className='break-words rounded bg-muted px-1 py-0.5 text-[0.8125rem]'>
                                        {children}
                                    </code>
                                ),
                                pre: ({ children }) => (
                                    <pre className='my-3 overflow-x-auto rounded-md bg-muted p-3'>{children}</pre>
                                ),
                                blockquote: ({ children }) => (
                                    <blockquote className='my-3 border-l-2 border-border pl-4 text-muted-foreground'>
                                        {children}
                                    </blockquote>
                                ),
                                a: ({ href, children }) => (
                                    <a
                                        href={href}
                                        className='break-words font-medium underline underline-offset-4'
                                        onClick={(event) => {
                                            event.preventDefault();
                                            if (/^https:\/\//i.test(href ?? '')) open(href);
                                        }}
                                    >
                                        {children}
                                    </a>
                                ),
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
