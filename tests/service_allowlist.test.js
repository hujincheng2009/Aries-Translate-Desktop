import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const serviceFiles = {
    translate: 'src/services/translate/index.jsx',
    recognize: 'src/services/recognize/index.jsx',
    tts: 'src/services/tts/index.jsx',
    collection: 'src/services/collection/index.jsx',
};
const rustLists = {
    recognize: 'builtin_recognize_list',
    translate: 'builtin_translate_list',
    tts: 'builtin_tts_list',
    collection: 'builtin_collection_list',
};

function readText(relativePath) {
    return readFileSync(new URL(relativePath, rootUrl), 'utf8');
}

function parseFrontendServices(source) {
    return [...source.matchAll(/^\s*export\s+const\s+([\w$]+)\s*=/gm)].map((match) => match[1]);
}

function parseRustServices(source, listName) {
    const match = source.match(
        new RegExp(`let\\s+${listName}\\s*:\\s*Vec<&str>\\s*=\\s*vec!\\s*\\[([\\s\\S]*?)\\]\\s*;`),
    );
    assert.ok(match, `Could not parse Rust service allowlist: ${listName}`);
    return [...match[1].matchAll(/"([^"\\]+)"/g)].map((value) => value[1]);
}

function sortedUnique(values) {
    return [...new Set(values)].sort();
}

test('frontend built-in services match Rust startup allowlists in both directions', () => {
    const rustSource = readText('src-tauri/src/config.rs');

    for (const [category, frontendPath] of Object.entries(serviceFiles)) {
        const frontendServices = sortedUnique(parseFrontendServices(readText(frontendPath)));
        assert.ok(frontendServices.length > 0, `Could not parse frontend service exports: ${category}`);

        const rustServices = sortedUnique(parseRustServices(rustSource, rustLists[category]));
        const frontendMissingFromRust = frontendServices.filter((name) => !rustServices.includes(name));
        const rustMissingFromFrontend = rustServices.filter((name) => !frontendServices.includes(name));

        assert.equal(
            frontendMissingFromRust.length + rustMissingFromFrontend.length,
            0,
            `${category} service allowlist mismatch; frontend missing from Rust: ${frontendMissingFromRust.join(', ') || '(none)'}; Rust missing from frontend: ${rustMissingFromFrontend.join(', ') || '(none)'}`,
        );
    }
});
