# Aries

Aries is a desktop selection translation, OCR and read-aloud app maintained by Myster_Jin, built with Tauri v1 and React 18. Current version: 1.1.0, which adds the selection assistant.

## Features

-   **Selection translation**: select text and press a hotkey. Several services answer side by side, with streaming output.
-   **Selection assistant** (Windows): select text in any program and a small icon appears next to the mouse. Expand it to translate, replace with the translation, copy or read aloud, with no hotkey to remember. Display style, buttons and position are configurable, and programs can be excluded. Off by default.
-   **Input translation**: type or paste text into the input window.
-   **Screenshot OCR and translation**: select a screen region to recognise its text and translate it in one step. QR codes and math formulas (LaTeX) are also recognised.
-   **Replacement translation**: replace the selected text with its translation in place, handy when writing in another language.
-   **Read aloud**: speak the source or the translation with adjustable speed and volume, optionally right after translating.
-   **Vocabulary**: add words to Anki or Eudic with one click.
-   **Many services**: 22 built-in translation services (DeepL, Google, Bing, OpenAI-compatible APIs, Gemini, local Ollama models, Baidu, Tencent, Youdao and more), 17 OCR engines and 6 voice services. Rarely used services can run on demand to save quota, and plugins add more.
-   **External calls**: a local HTTP interface lets other tools and scripts trigger translation and OCR.
-   **History and backup**: searchable translation history, with backups to a local folder or WebDAV.

## Downloads and source

Each Windows x64 installer is accompanied by its matching source ZIP. See the [Aries 1.1.0 release page](https://github.com/hujincheng2009/Aries-Translate-Desktop/releases/tag/aries-1.1.0). Supply the matching source ZIP when distributing an installer.

## Build

Install Node.js with corepack/pnpm, Rust and the Windows C++ build tools.

```powershell
corepack pnpm@11.19.0 install
corepack pnpm@11.19.0 test
Set-Location src-tauri
cargo test
Set-Location ..
node node_modules/@tauri-apps/cli/tauri.js build
```

Preview the UI using node node_modules/vite/bin/vite.js --host 127.0.0.1 and app-preview.html. The preview uses an in-memory profile. macOS and Linux source paths are retained, but this release has not been built or validated on those platforms.

## License and origin

Copyright © 2026 Myster_Jin. Aries is a modified version of [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) 3.0.7, modified on 2026-10-08. Original copyright notices continue to apply. Distributed under [GNU GPL-3.0-only](LICENSE), WITHOUT ANY WARRANTY. Corresponding Source accompanies each installer; LICENSE is preserved verbatim.
