import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// A large-language-model result shown as Markdown in a translation card (1.1.4). Sizes are in em so the text follows
// the translate window font size. Links and images are plain text: this is a translator, nothing here opens a page.

const plain = ({ children }) => <span>{children}</span>;

const components = {
    h1: ({ children }) => <p className='my-[0.5em] text-[1.125em] font-semibold'>{children}</p>,
    h2: ({ children }) => <p className='my-[0.5em] text-[1.0625em] font-semibold'>{children}</p>,
    h3: ({ children }) => <p className='my-[0.5em] font-semibold'>{children}</p>,
    h4: ({ children }) => <p className='my-[0.5em] font-semibold'>{children}</p>,
    h5: ({ children }) => <p className='my-[0.5em] font-semibold'>{children}</p>,
    h6: ({ children }) => <p className='my-[0.5em] font-semibold'>{children}</p>,
    p: ({ children }) => <p className='my-[0.5em]'>{children}</p>,
    ul: ({ children }) => <ul className='my-[0.5em] list-disc space-y-[0.25em] pl-[1.5em]'>{children}</ul>,
    ol: ({ children, start }) => (
        <ol
            start={start}
            className='my-[0.5em] list-decimal space-y-[0.25em] pl-[1.5em]'
        >
            {children}
        </ol>
    ),
    table: ({ children }) => (
        <div className='my-[0.75em] overflow-x-auto'>
            <table className='w-full border-separate border-spacing-0 text-left text-[0.875em]'>{children}</table>
        </div>
    ),
    th: ({ children }) => <th className='border-b bg-muted px-[0.75em] py-[0.4em] font-medium'>{children}</th>,
    td: ({ children }) => <td className='border-b px-[0.75em] py-[0.4em] align-top'>{children}</td>,
    code: ({ children }) => (
        <code className='break-words rounded bg-muted px-[0.3em] py-[0.1em] font-mono text-[0.875em]'>{children}</code>
    ),
    pre: ({ children }) => (
        <pre className='my-[0.75em] overflow-x-auto rounded-md bg-muted p-[0.75em] text-[0.875em] [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-[1em]'>
            {children}
        </pre>
    ),
    blockquote: ({ children }) => (
        <blockquote className='my-[0.75em] border-l-2 border-border pl-[0.75em] text-muted-foreground'>
            {children}
        </blockquote>
    ),
    hr: () => <hr className='my-[0.75em] border-border' />,
    a: plain,
    img: ({ alt }) => <span>{alt}</span>,
};

export default function MarkdownResult({ text }) {
    return (
        <div className='select-text break-words leading-[1.6] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0'>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
}
