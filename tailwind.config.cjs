// tailwind.config.js
const animate = require('tailwindcss-animate');

// rgb channels + optional per-token alpha, so `bg-primary/90` and translucent dark tokens both work
const token = (name) => `rgb(var(--${name}) / calc(var(--${name}-alpha, 1) * <alpha-value>))`;

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: {
        // resolve the globs from this file instead of the current working directory
        relative: true,
        files: ['./index.html', './ui-preview.html', './src/**/*.{js,ts,jsx,tsx}'],
    },
    theme: {
        extend: {
            // shadcn/ui · Vega tokens (see src/styles/tokens.css)
            colors: {
                border: token('border'),
                input: token('input'),
                ring: token('ring'),
                background: { DEFAULT: token('background') },
                foreground: { DEFAULT: token('foreground') },
                primary: {
                    DEFAULT: token('primary'),
                    foreground: token('primary-foreground'),
                    vivid: token('primary-vivid'),
                    text: token('primary-text'),
                },
                secondary: { DEFAULT: token('secondary'), foreground: token('secondary-foreground') },
                destructive: { DEFAULT: token('destructive'), foreground: token('primary-foreground') },
                muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
                accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
                popover: { DEFAULT: token('popover'), foreground: token('popover-foreground') },
                card: { DEFAULT: token('card'), foreground: token('card-foreground') },
                sidebar: {
                    DEFAULT: token('sidebar'),
                    foreground: token('sidebar-foreground'),
                    accent: token('sidebar-accent'),
                    'accent-foreground': token('sidebar-accent-foreground'),
                    border: token('sidebar-border'),
                },
                'switch-track': token('switch-track'),
                'switch-thumb-on': token('switch-thumb-on'),
                'switch-thumb-off': token('switch-thumb-off'),
                warning: {
                    DEFAULT: token('warning'),
                    foreground: token('warning-foreground'),
                    border: token('warning-border'),
                },
            },
            borderRadius: {
                xl: 'calc(var(--radius) + 4px)',
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)',
            },
            boxShadow: {
                xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            },
        },
    },
    darkMode: 'class',
    plugins: [animate],
};
