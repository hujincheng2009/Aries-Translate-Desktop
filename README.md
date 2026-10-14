# Aries

Aries 是由 Myster_Jin 维护的桌面划词翻译、文字识别和朗读应用，基于 Tauri v1 与 React 18。当前版本为 1.1.0，新增划词助手。

## 功能

-   **划词翻译**：选中文字按快捷键即可翻译，多个服务同时给出结果，并支持流式输出。
-   **划词助手**（Windows）：在任何软件里选中文字，鼠标旁边就会出现一个小图标，展开后可以翻译、替换翻译、复制或朗读，不用记快捷键。显示方式、按钮和弹出位置都可以设置，也可以排除指定软件。默认关闭。
-   **输入翻译**：打开输入框，直接输入或粘贴要翻译的内容。
-   **截图识别与翻译**：框选屏幕区域识别文字，可以一步翻译；也能识别二维码和数学公式（LaTeX）。
-   **替换翻译**：把选中的文字直接替换成译文，适合在输入框里写外语。
-   **朗读**：朗读原文或译文，可调倍速和音量，也可以在翻译后自动朗读。
-   **生词本**：一键把单词加入 Anki 或欧路词典。
-   **服务丰富**：内置 22 种翻译服务（DeepL、Google、Bing、OpenAI 兼容接口、Gemini、Ollama 本地模型、百度、腾讯、有道等）、17 种文字识别和 6 种语音服务。不常用的服务可以设为按需调用，节省额度；还能通过插件扩展。
-   **外部调用**：提供本地 HTTP 接口，可以从其他工具或脚本触发翻译和识别。
-   **历史与备份**：翻译历史可以搜索，配置可以备份到本地或 WebDAV。

## 下载与源码

Windows x64 安装包和对应源码 ZIP 同版本提供，见 [Aries 1.1.0 发布页](https://github.com/hujincheng2009/Aries-Translate-Desktop/releases/tag/aries-1.1.0)。分发安装包时应一并提供对应版本的源码 ZIP。

## 构建

需要 Node.js、corepack/pnpm、Rust 和 Windows C++ 构建工具。

```powershell
corepack pnpm@11.19.0 install
corepack pnpm@11.19.0 test
Set-Location src-tauri
cargo test
Set-Location ..
node node_modules/@tauri-apps/cli/tauri.js build
```

界面预览：node node_modules/vite/bin/vite.js --host 127.0.0.1，打开 app-preview.html；预览只用内存配置。macOS / Linux 保留源码路径，尚未验证本版本构建或真机行为。

## 许可与来源

Copyright © 2026 Myster_Jin。Aries 修改自 [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop) 3.0.7。原有版权声明继续适用，修改日期为 2026-10-08。按 [GNU GPL-3.0-only](LICENSE) 发布，不提供任何担保。Corresponding Source 随每个安装包提供；根目录 LICENSE 保持原文。
