# Gemini / Google AI Studio 开通指南

## 这是什么、适合谁

适合使用免费层模型进行翻译、TTS 或 Live 朗读。AI Studio 的 Gemini Developer API 与 Google Cloud Translation、Vision、Cloud TTS 分开。

## 开通步骤

1. 登录 [Google AI Studio](https://aistudio.google.com/)，确认账户年龄、所在地区符合 [支持地区](https://ai.google.dev/gemini-api/docs/available-regions) 要求。
2. 打开 [API Keys](https://aistudio.google.com/api-keys)，创建或导入项目，再点击“Create API key”，复制 Key。仅用免费层不需要开通付费结算。
3. 在 Aries 添加 Gemini Free API、Gemini 翻译、Gemini TTS 或 Gemini Live，填入 Key。
4. 打开 [项目限额](https://aistudio.google.com/rate-limit)，查看每个模型的 RPM、TPM、RPD。官网现在将实际限额放在账户中，本指南不虚构统一数字。
5. 对照 [价格页](https://ai.google.dev/gemini-api/docs/pricing) 的“Standard / Free Tier”和可用模型，选择翻译、TTS 或 Live 对应的模型 ID。

## 免费层模型与超额

| 用途 / 示例模型 ID                                | 免费层            | 每分钟 / 每日限制        | 超出后             |
| ------------------------------------------------- | ----------------- | ------------------------ | ------------------ |
| 翻译：`gemini-3.1-flash-lite`、`gemini-3.7-flash` | Standard 有免费层 | 查看项目 RPM / TPM / RPD | 限流，付费层另计费 |
| TTS：`gemini-3.8-flash-lite-tts`                  | 有免费层          | 查看项目模型限额         | 限流，试听也计额度 |
| Live：`gemini-3.8-live`                           | 有免费层          | 查看项目模型限额         | 限流或连接被拒绝   |

以上是可用免费层的示例，不是永久可用承诺。付费模型价格随模型、输入输出类型和结算层变化，升级前逐项查看价格页，不自动转为付费。

## Gemini Free API 的轮询

Aries 按已配置顺序尝试模型，暂时跳过限流或日额度用完的模型；成功后停止。默认模型列表也要以当前项目可用性核对。项目级额度由 Key 共享，换 Key 不能绕过限额；RPD 在太平洋时间午夜重置。

## 音色与安全

TTS 使用服务提供的音色列表（如 Kore、Puck）；是否免费取决于模型与结算层，不取决于音色名。Live 当前不支持日语。免费层请求和回答可能用于改进 Google 产品，勿提交敏感或机密内容。不要公开 Key；仅免费使用时不要启用付费结算。

## 常见问题

-   400 / 模型不兼容：核对模型用途与模型 ID。
-   403 / 地区不支持：确认支持地区、账户资格及 Key 权限。
-   429：查看模型的 RPM、TPM、RPD；先等待，不反复点击测试。
-   404：模型可能停用，换为控制台当前可用的免费模型。

价格以官方页面为准。

[价格与免费层](https://ai.google.dev/gemini-api/docs/pricing) · [限额说明](https://ai.google.dev/gemini-api/docs/rate-limits) · [API Key](https://ai.google.dev/gemini-api/docs/api-key) · [使用条款与数据](https://ai.google.dev/gemini-api/terms)
