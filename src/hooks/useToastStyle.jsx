// Toast colors follow the shadcn tokens in src/styles/tokens.css, so they switch with the .dark class.
export const useToastStyle = () => {
    const toastStyle = {
        background: 'rgb(var(--popover))',
        color: 'rgb(var(--popover-foreground))',
        border: '1px solid rgb(var(--border) / var(--border-alpha, 1))',
        boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
        fontSize: '0.875rem',
        wordBreak: 'break-all',
        select: 'text',
    };

    return toastStyle;
};
