# Google Cloud 开通指南

## 这是什么、适合谁

适合需要官方翻译、语音或文字识别 API 的用户。Aries 翻译使用 Basic v2 的 NMT；Google OCR 使用 Cloud Vision，不使用 Gemini Key。

## 开通步骤

1. 打开 [Google Cloud 控制台](https://console.cloud.google.com/)，在顶部项目菜单选择“新建项目”，记下项目 ID。
2. 进入 [结算](https://console.cloud.google.com/billing)，按账号要求绑定付款方式并将项目关联结算账户。免费额度内不收费，超额可自动收费。
3. 打开 API 库，分别启用 [Cloud Translation API](https://console.cloud.google.com/apis/library/translate.googleapis.com)、[Cloud Text-to-Speech API](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)、[Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com)。只启用要用的服务。
4. 在 [凭据](https://console.cloud.google.com/apis/credentials) 点击“创建凭据 → API 密钥”，再编辑 Key，在“API 限制”选择上述要用的 API。不同服务可使用单独的 Key。
5. 在 Aries 的对应服务粘贴 Key。翻译填 API Key；OCR 填 API Key；语音选择 API Key 认证并填“凭据”。不要把 AI Studio Key 填到这里。
6. 进入 [配额与系统限制](https://console.cloud.google.com/iam-admin/quotas)，按 API 筛选，将可调整的请求或字符配额降到实际需要的上限。并非每项都有“每日”配额。
7. 开启 [预算提醒](https://console.cloud.google.com/billing/budgets)。预算提醒不是消费硬上限，不能保证阻止扣费；控制用量要结合 API 配额。

## 月免费额度与超额价格

| 服务 / 系列                    | 月免费额度      | 超额价格（USD）           | 备注                                           |
| ------------------------------ | --------------- | ------------------------- | ---------------------------------------------- |
| Translation NMT                | 50 万字符       | $20 / 百万字符            | Basic / Advanced 共用 $10 抵扣，不适用文档翻译 |
| TTS Standard / WaveNet         | 合计 400 万字符 | $4 / 百万字符             | 同一 SKU，共享额度                             |
| TTS Neural2 / Polyglot         | 合计 100 万字符 | $16 / 百万字符            | 同一 SKU，共享额度                             |
| TTS Chirp 3 HD                 | 100 万字符      | $30 / 百万字符            | 独立系列                                       |
| TTS Studio                     | 100 万字符      | $160 / 百万字符           | 超额昂贵，少量使用                             |
| Vision Text Detection          | 1000 单位       | $1.50 / 1000 单位（首档） | 每图 / 每页按功能计单位                        |
| Vision Document Text Detection | 1000 单位       | $1.50 / 1000 单位（首档） | 与上行按各功能分别计量                         |

## 免费额度内可选的音色

按 Standard、WaveNet、Neural2、Polyglot、Chirp 3 HD、Studio 系列选择；具体语言与音色以服务返回列表为准。此表不包括没有月免费额度的系列。语音试听也计字符。

## 省钱与安全设置

只给 Key 开启所需 API；桌面程序使用前核对应用限制是否适合你的环境。切勿把 Key 发到聊天、截图或公开仓库。一个项目创建多个 Key 不会增加共享免费额度。

## 常见问题

-   403：检查结算、API 是否启用，以及 Key 的限制。
-   429：查看字符、请求配额；降低并发，等额度恢复。
-   找不到音色：重新加载列表，核对语言、系列与账号权限。

价格以官方页面为准。

[Translation 价格](https://cloud.google.com/translate/pricing) · [TTS 价格](https://cloud.google.com/text-to-speech/pricing) · [Vision 价格](https://cloud.google.com/vision/pricing) · [API Key 限制](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys) · [预算说明](https://cloud.google.com/billing/docs/how-to/budgets)
