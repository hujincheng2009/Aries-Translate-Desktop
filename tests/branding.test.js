import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const walk = (root) =>
    fs
        .readdirSync(root, { withFileTypes: true })
        .flatMap((entry) => (entry.isDirectory() ? walk(`${root}/${entry.name}`) : [`${root}/${entry.name}`]));

// Exact compatibility exceptions. Documentation is provided by Aries.
// and Lingva speech exceptions when the system speech service replaces it.
function allowed(file, line) {
    if (/^src\/services\/tts\/lingva\/(Config|index)\.jsx$/.test(file) && /lingva\.pot-app\.com/.test(line))
        return true;
    if (
        file === 'src-tauri/src/config.rs' &&
        /com\.pot-app\.(desktop|personal)|profile imported|profile found|\/\/\//.test(line)
    )
        return true;
    if (file === 'src-tauri/src/main.rs' && /^\s*\/\/ Import the/.test(line)) return true;
    if (file === 'src-tauri/src/backup.rs' && /"(?:\/)?pot-app(?:\/a\.zip|\/)?"/.test(line)) return true;
    if (file === 'src/services/collection/anki/index.jsx' && /'Pot(?: Card 2)?'/.test(line)) return true;
    if (file === 'src/utils/anki_names.js' && /'Pot(?: Card 2)?'/.test(line)) return true;
    if (
        /^src\/i18n\/locales\/(zh_CN|zh_TW|en_US)\.json$/.test(file) &&
        /"(?:license_description|original_copyright)":/.test(line)
    )
        return true;
    return false;
}

test('application branding contains only documented source and compatibility exceptions', () => {
    const files = [
        ...walk('src'),
        ...walk('src-tauri/src'),
        ...walk('public'),
        ...fs
            .readdirSync('src-tauri')
            .filter((name) => name.endsWith('.json'))
            .map((name) => `src-tauri/${name}`),
        'index.html',
    ];
    const violations = [];
    for (const file of files.filter((name) => /\.(?:jsx?|tsx?|rs|css|json|html|svg|xml|txt)$/.test(name))) {
        fs.readFileSync(file, 'utf8')
            .split('\n')
            .forEach((line, index) => {
                if (/pot-app\.com|pot-desktop|\bPot\b/.test(line) && !allowed(file, line))
                    violations.push(`${file}:${index + 1}`);
            });
    }
    assert.deepEqual(violations, []);
});

test('installer contains BOM and the unmodified complete GPL text', () => {
    const installer = fs.readFileSync('src-tauri/installer/LICENSE.txt');
    assert.deepEqual([...installer.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.ok(installer.toString('utf8').endsWith(fs.readFileSync('LICENSE', 'utf8')));
    assert.match(installer.toString('utf8'), /Copyright © 2026 Myster_Jin/);
});

test('all updater configurations disable upstream update channels', () => {
    for (const name of ['tauri.conf.json', 'webview.x64.json', 'webview.x86.json', 'webview.arm64.json']) {
        const { updater } = JSON.parse(fs.readFileSync(path.join('src-tauri', name), 'utf8')).tauri;
        assert.equal(updater.active, false);
        assert.deepEqual(updater.endpoints, []);
        assert.equal(updater.pubkey, undefined);
    }
});
