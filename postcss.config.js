import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Resolve the Tailwind config from this file, so builds work no matter which directory starts Vite.
const root = dirname(fileURLToPath(import.meta.url));

export default {
    plugins: {
        tailwindcss: { config: resolve(root, 'tailwind.config.cjs') },
        autoprefixer: {},
    },
};
