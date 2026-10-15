// Dev-only harness: runs the real app windows in a normal browser with Tauri APIs mocked.
// Open while `pnpm dev` runs, for example:
//   http://localhost:1420/app-preview.html?window=config&route=/general&theme=dark
// Query parameters:
//   window  Tauri window label to render (config, translate, recognize, read_aloud, updater, screenshot). Default: config
//   route   React Router path inside the window. Default: /general
//   theme   light | dark | system. Default: light
//   lang    app_language value, for example zh_cn, zh_tw, en. Default: zh_cn
//   os      Windows_NT | Darwin | Linux. Default: Windows_NT
//   text    source text for window=translate (default: an English sentence; [INPUT_TRANSLATE] = empty input mode).
//           Translation requests are not mocked, so result cards show the service's error message.
//   ocr     window=recognize: text returned by the system OCR (default: an English sentence); ocr=error makes it fail.
//           The captured image is a generated sample picture.
//   read_aloud  window=read_aloud: text of the read-aloud request (default: no request, empty window).
//           Speech synthesis is not mocked, so the window ends in its error state; time labels need real audio.
//   update  window=updater: available (default, sample changelog) | latest (already up to date) | loading (skeleton)
//   progress  window=updater: percent (1-99) of a simulated download; shows the progress bar and the "downloading" button
//   window=selection_bar shows the selection assistant popup. bar=icon (default) | toolbar | hover | busy | copied |
//           error picks its state; store.selection_assistant_button_style="icon" etc. change its settings.
//           The page is transparent like the real window; add theme=dark to check dark mode.
//   window=screenshot shows a generated sample picture as the frozen screenshot, so the selection overlay,
//           size label and hint can be tried with the mouse.
//   openai_error=<param>  OpenAI-compatible requests answer HTTP 400 rejecting that parameter (default temperature),
//           e.g. openai_error=reasoning_effort, to check the located-error marking in the OpenAI service dialog.
//   sample=history       serve sample rows for the history table (history.db queries)
//   sample=plugins       pretend two plugins are installed per service type (no icons), so the Service page can
//                        show plugin rows and the "add external plugin" list. Instance keys that use them:
//                        plugin.demo.deeplx@a1 and plugin.demo.chatglm@b2, e.g.
//                        store.translate_service_list=["deepl","plugin.demo.deeplx@a1","bing"]
//                        (samples can be combined with commas: sample=history,plugins)
//   store.<key>=<value>  preset any config key; the value is parsed as JSON when possible,
//                        for example store.app_font_size=24 or store.translate_close_on_blur=false
// Nothing here touches the real Aries config: the store lives in memory and resets on reload.
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';

const params = new URLSearchParams(window.location.search);
const label = params.get('window') || 'config';
const route = params.get('route') || (label === 'config' ? '/general' : '/');
const os = params.get('os') || 'Windows_NT';

const memoryStore = {
    app_theme: params.get('theme') || 'light',
    app_language: params.get('lang') || 'zh_cn',
};

for (const [key, raw] of params.entries()) {
    if (!key.startsWith('store.')) continue;
    let value = raw;
    try {
        value = JSON.parse(raw);
    } catch {
        // keep plain strings such as store.app_font=Arial
    }
    memoryStore[key.slice('store.'.length)] = value;
}

const samples = (params.get('sample') || '').split(',');
const previewRequests = [];
const previewAudio = [];
if (samples.includes('translation')) {
    // Deterministic, silent media fixture; never calls a real speech provider.
    window.Audio = class {
        constructor() {
            this.currentTime = 0;
            this.duration = 30;
            this.paused = true;
            this.ended = false;
            this.volume = 1;
            previewAudio.push(this);
        }
        async play() {
            this.paused = false;
            this.ended = false;
            clearInterval(this.timer);
            this.timer = setInterval(() => {
                this.currentTime += 0.1 * this.playbackRate;
                if (this.currentTime >= this.duration) {
                    this.ended = true;
                    this.pause();
                    this.onended?.();
                }
            }, 100);
        }
        pause() {
            this.paused = true;
            clearInterval(this.timer);
        }
        removeAttribute() {}
    };
}

const samplePlugins = [
    { name: 'plugin.demo.deeplx', display: 'DeepLX 翻译' },
    { name: 'plugin.demo.chatglm', display: 'ChatGLM 翻译' },
];

const sampleHistory = samples.includes('history')
    ? [
          [
              samples.includes('openai') ? 'openai' : 'deepl',
              'Aries is a cross-platform software for text translation and recognition.',
              'en',
              'zh_cn',
              'Aries 是一款跨平台的划词翻译和文字识别软件。',
          ],
          ['google', 'The quick brown fox jumps over the lazy dog.', 'en', 'zh_cn', '敏捷的棕色狐狸跳过了那只懒狗。'],
          ['bing', 'incremental translation', 'en', 'zh_cn', '增量翻译'],
          [
              'deepl',
              '设计系统让界面在不同页面之间保持一致。',
              'zh_cn',
              'en',
              'A design system keeps the interface consistent across pages.',
          ],
          ['bing_dict', 'serendipity', 'en', 'zh_cn', 'n. 意外发现珍奇事物的本领；机缘凑巧'],
          ['google', 'Bonjour, comment ça va ?', 'fr', 'zh_cn', '你好，最近怎么样？'],
      ].map(([service, text, source, target, result], i) => ({
          id: 100 - i,
          service,
          text,
          source,
          target,
          result,
          timestamp: Date.now() - i * 3600 * 1000,
      }))
    : [];

let nextEventId = 1;
const eventHandlers = {};

function fireEvent(event, payload) {
    for (const { id, handler } of eventHandlers[event] ?? []) {
        window[`_${handler}`]?.({ event, id, payload });
    }
}

// Generated sample picture (a gradient with a card of text), used for the recognize image and the screenshot.
function drawSamplePicture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#3b4a6b');
    gradient.addColorStop(1, '#6b4a6b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const cardWidth = width * 0.7;
    const cardHeight = height * 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((width - cardWidth) / 2, (height - cardHeight) / 2, cardWidth, cardHeight);
    ctx.fillStyle = '#222222';
    ctx.font = `${Math.round(cardHeight / 8)}px sans-serif`;
    ctx.fillText('Machine translation has improved', (width - cardWidth) / 2 + 24, height / 2 - cardHeight / 8);
    ctx.fillText('dramatically over the past decade,', (width - cardWidth) / 2 + 24, height / 2 + 8);
    ctx.fillText('making it a practical tool.', (width - cardWidth) / 2 + 24, height / 2 + cardHeight / 8 + 24);
    return canvas.toDataURL('image/png');
}

const sampleUpdateBody = [
    '## v1.0.4',
    '',
    '### 新功能',
    '',
    '- 新增朗读窗口，支持倍速与重新播放',
    '- 翻译服务支持“按需调用”',
    '- 新增 `Google Cloud`、Azure 等服务',
    '',
    '### 修复',
    '',
    '- 修复截图翻译在多屏下的定位问题',
].join('\n');

if (label === 'screenshot') {
    // The window loads its screenshot from the asset protocol; swap that for the generated picture.
    const setAttribute = HTMLImageElement.prototype.setAttribute;
    HTMLImageElement.prototype.setAttribute = function (name, value) {
        if (name === 'src' && String(value).includes('aries_screenshot.png')) {
            value = drawSamplePicture(screen.width * 2, screen.height * 2);
        }
        return setAttribute.call(this, name, value);
    };
}

function handleTauriModule({ __tauriModule: module, message = {} }) {
    switch (module) {
        case 'Path':
            return message.cmd === 'join' ? message.paths.join('/') : '/mock/com.aries.translate';
        case 'Os':
            return {
                osType: os,
                platform: os === 'Darwin' ? 'darwin' : os === 'Linux' ? 'linux' : 'win32',
                arch: 'x86_64',
                version: '10.0.26200',
                locale: 'zh-CN',
            }[message.cmd];
        case 'App':
            return {
                getAppVersion: '1.1.2',
                getAppName: 'Aries',
                getTauriVersion: '1.6.0',
            }[message.cmd];
        case 'Event':
            if (message.cmd === 'listen') {
                const id = nextEventId++;
                (eventHandlers[message.event] ??= []).push({ id, handler: message.handler });
                if (message.event === 'tauri://update-download-progress' && params.has('progress')) {
                    setTimeout(
                        () =>
                            fireEvent(message.event, {
                                contentLength: 100,
                                chunkLength: Number(params.get('progress')),
                            }),
                        100
                    );
                }
                return id;
            }
            if (message.cmd === 'emit' && message.event === 'tauri://update') {
                const update = params.get('update') || 'available';
                if (update === 'available') {
                    setTimeout(
                        () => fireEvent('tauri://update-available', { version: '1.0.4', body: sampleUpdateBody }),
                        100
                    );
                } else if (update === 'latest') {
                    setTimeout(() => fireEvent('tauri://update-status', { status: 'UPTODATE' }), 100);
                }
            }
            if (message.cmd === 'emit') fireEvent(message.event, message.payload);
            return null;
        case 'Window':
            if (message.cmd === 'manage' && message.data?.cmd?.type === 'currentMonitor') {
                return {
                    name: 'Mock monitor',
                    scaleFactor: 2,
                    position: { x: 0, y: 0 },
                    size: { width: screen.width * 2, height: screen.height * 2 },
                };
            }
            return null;
        case 'Http': {
            if (message.cmd === 'createClient') return 1;
            if (
                message.cmd === 'httpRequest' &&
                params.has('openai_error') &&
                message.options.url.includes('/chat/completions')
            ) {
                const param = params.get('openai_error') || 'temperature';
                const error = { message: `Unsupported parameter: ${param}`, type: 'invalid_request_error', param };
                return { url: message.options.url, status: 400, headers: {}, data: JSON.stringify({ error }) };
            }
            if (message.cmd === 'httpRequest' && params.has('service_error')) {
                const status = Number(params.get('service_error')) || 429;
                throw Object.assign(
                    new Error(`HTTP ${status}: simulated service error; api_key=preview-only-credential`),
                    { status }
                );
            }
            if (!samples.includes('translation') || message.cmd !== 'httpRequest') return null;
            const options = message.options;
            const url = options.url;
            previewRequests.push({ url, text: options.query?.q ?? options.body?.payload?.[0]?.Text, at: Date.now() });
            const response = (data) => ({ url, status: 200, headers: {}, data: JSON.stringify(data) });
            if (url.includes('/translate/auth')) return { url, status: 200, headers: {}, data: 'preview-token' };
            if (url.includes('microsofttranslator.com'))
                return new Promise((resolve, reject) =>
                    setTimeout(
                        () =>
                            params.has('bing_error')
                                ? reject(new Error('Simulated translation failure'))
                                : resolve(
                                      response([
                                          {
                                              translations: [
                                                  { text: 'First service: ' + options.body.payload[0].Text },
                                              ],
                                          },
                                      ])
                                  ),
                        Number(params.get('bing_delay') ?? 400)
                    )
                );
            if (url.includes('/translate_a/single'))
                return new Promise((resolve) =>
                    setTimeout(
                        () => resolve(response([[['Second service: ' + options.query.q]]])),
                        Number(params.get('google_delay') ?? 50)
                    )
                );
            if (url.includes('/audio/')) return response({ audio: [1, 2, 3] });
            return null;
        }
        case 'Fs':
            if (!samples.includes('plugins')) return null;
            if (message.cmd === 'exists') return /^plugins\/[a-z]+$/.test(message.path);
            if (message.cmd === 'readDir') return samplePlugins.map(({ name }) => ({ name, path: name }));
            if (message.cmd === 'readTextFile') {
                const plugin = samplePlugins.find(({ name }) => message.path.includes(`/${name}/`));
                if (samples.includes('translation') && message.path.endsWith('main.js')) {
                    return `async function translate(text, from, to, options) { options.setResult('Streaming preview…'); await new Promise(resolve => setTimeout(resolve, ${Number(params.get('stream_delay') ?? 400)})); return 'Stream final: ' + text; }`;
                }
                return JSON.stringify({
                    id: plugin.name,
                    display: plugin.display,
                    homepage: '',
                    needs: [],
                    language: { auto: 'auto', en: 'en', zh_cn: 'zh', zh_tw: 'zh-TW' },
                });
            }
            return null;
        default:
            return null;
    }
}

mockWindows(label, 'config', 'translate', 'recognize', 'read_aloud', 'updater', 'screenshot');
mockIPC((cmd, args) => {
    if (cmd === 'tauri') return handleTauriModule(args);
    switch (cmd) {
        case 'plugin:store|get':
            return args.key in memoryStore ? memoryStore[args.key] : null;
        case 'plugin:store|set':
            memoryStore[args.key] = args.value;
            return null;
        case 'plugin:store|has':
            return args.key in memoryStore;
        case 'plugin:store|delete':
            delete memoryStore[args.key];
            return true;
        case 'plugin:store|keys':
            return Object.keys(memoryStore);
        case 'plugin:store|entries':
            return Object.entries(memoryStore);
        case 'plugin:sql|load':
            return args.db;
        case 'plugin:sql|execute':
            return [1, 1];
        case 'plugin:sql|select':
            if (/COUNT\(\*\)/.test(args.query)) return [{ 'COUNT(*)': sampleHistory.length }];
            if (/WHERE id=/.test(args.query)) return sampleHistory.filter((row) => row.id === args.values[0]);
            return sampleHistory;
        case 'plugin:autostart|is_enabled':
            return false;
        case 'font_list':
            return ['Arial', 'Microsoft YaHei', 'Segoe UI', 'Inter', 'Noto Sans SC'];
        case 'lang_detect':
            return 'en';
        case 'webdav':
            if (args.operate === 'list')
                return JSON.stringify([
                    { name: 'current.zip', path: 'aries/current.zip', legacy: false },
                    { name: 'old.zip', path: 'pot-app/old.zip', legacy: true },
                ]);
            return '';
        case 'get_text':
            // text the translate window opens with; [INPUT_TRANSLATE] opens it empty
            return params.get('text') ?? 'Aries is a cross-platform software for text translation and recognition.';
        case 'get_base64':
            return drawSamplePicture(600, 300).split(',')[1];
        case 'system_ocr':
            if (params.get('ocr') === 'error') throw new Error('OCR failed (preview)');
            return (
                params.get('ocr') ??
                'Machine translation has improved dramatically over the past decade, making it a practical tool for everyday reading.'
            );
        case 'selection_assistant_running_apps':
            return [
                { exe: 'Code.exe', title: 'notes.md - Visual Studio Code' },
                { exe: 'msedge.exe', title: 'Aries - Microsoft Edge' },
                { exe: 'WeChat.exe', title: '微信' },
            ];
        case 'selection_bar_set_size':
            window.__ARIES_PREVIEW__.barSize = args;
            return null;
        case 'selection_bar_action':
            previewRequests.push({ command: cmd, ...args });
            return null;
        case 'get_read_aloud_request':
            return params.has('read_aloud') ? { request_id: 1, text: params.get('read_aloud') } : null;
        default:
            // plugin:store|save/load, plugin:fs-watch|watch, plugin:log|log and app commands are no-ops here
            return null;
    }
});

// convertFileSrc is a synchronous WebView bridge API, not part of mockIPC.
// Keep asset URLs inside the generated fixture; no real file access is performed.
window.__TAURI__ = {
    ...window.__TAURI__,
    convertFileSrc: () => drawSamplePicture(screen.width, screen.height),
};
window.history.replaceState(null, '', route);
window.__ARIES_PREVIEW__ = { store: memoryStore, fireEvent, requests: previewRequests, audio: previewAudio };
window.__ARIES_PREVIEW__.getState = async () => {
    const { getDefaultStore } = await import('jotai');
    const { autoReadAloudAtom } = await import('../hooks/useAutoReadAloud');
    const { sourceTextAtom } = await import('../window/Translate/components/SourceArea');
    const { sourceLanguageAtom, targetLanguageAtom } = await import('../window/Translate/components/LanguageArea');
    const store = getDefaultStore();
    return {
        auto: store.get(autoReadAloudAtom),
        text: store.get(sourceTextAtom),
        source: store.get(sourceLanguageAtom),
        target: store.get(targetLanguageAtom),
    };
};

if (label === 'selection_bar') {
    // Drive the popup the way the Rust worker does (see src-tauri/src/selection_assistant/windows.rs).
    const bar = params.get('bar') || 'icon';
    const setting = (key, fallback) => memoryStore[`selection_assistant_${key}`] ?? fallback;
    const settings = {
        displayMode: bar === 'icon' ? 'icon' : 'toolbar',
        buttonStyle: setting('button_style', 'icon'),
        showLogo: setting('show_logo', true),
        actions: setting('actions', ['translate', 'replace_translate', 'copy', 'read_aloud']),
    };
    const states = { busy: 'translate', copied: 'copy', error: 'replace_translate' };
    setTimeout(() => {
        fireEvent('selection_bar_show', { seq: 1, textKnown: true, settings });
        setTimeout(() => {
            if (bar === 'hover') {
                const button = document.querySelector('[data-action="translate"]')?.getBoundingClientRect();
                if (button)
                    fireEvent('selection_bar_pointer', {
                        seq: 1,
                        x: button.left + button.width / 2,
                        y: button.top + button.height / 2,
                        inside: true,
                    });
            }
            if (states[bar])
                fireEvent('selection_bar_state', {
                    seq: 1,
                    action: states[bar],
                    status: bar,
                    message: bar === 'error' ? 'window_changed' : '',
                });
        }, 300);
    }, 1200);
}

import('../main.jsx');
