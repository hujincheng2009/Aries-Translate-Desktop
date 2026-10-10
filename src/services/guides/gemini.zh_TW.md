# Gemini / Google AI Studio 開通指南

## 這是什麼、適合誰

適合使用免費層模型進行翻譯、TTS 或 Live 朗讀。AI Studio 的 Gemini Developer API 與 Google Cloud Translation、Vision、Cloud TTS 分開。

## 開通步驟

1. 登入 [Google AI Studio](https://aistudio.google.com/)，確認帳戶年齡、所在地區符合 [支援地區](https://ai.google.dev/gemini-api/docs/available-regions) 要求。
2. 開啟 [API Keys](https://aistudio.google.com/api-keys)，建立或匯入專案，再點選「Create API key」，複製 Key。僅用免費層不需要啟用付費帳單。
3. 在 Aries 新增 Gemini Free API、Gemini 翻譯、Gemini TTS 或 Gemini Live，填入 Key。
4. 開啟 [專案限額](https://aistudio.google.com/rate-limit)，查看每個模型的 RPM、TPM、RPD。官網現在將實際限額放在帳戶中，本指南不虛構統一數字。
5. 對照 [價格頁](https://ai.google.dev/gemini-api/docs/pricing) 的「Standard / Free Tier」和可用模型，選擇翻譯、TTS 或 Live 對應的模型 ID。

## 免費層模型與超額

| 用途 / 範例模型 ID                                | 免費層            | 每分鐘 / 每日限制        | 超出後             |
| ------------------------------------------------- | ----------------- | ------------------------ | ------------------ |
| 翻譯：`gemini-3.1-flash-lite`、`gemini-3.7-flash` | Standard 有免費層 | 查看專案 RPM / TPM / RPD | 限流，付費層另計費 |
| TTS：`gemini-3.8-flash-lite-tts`                  | 有免費層          | 查看專案模型限額         | 限流，試聽也計額度 |
| Live：`gemini-3.8-live`                           | 有免費層          | 查看專案模型限額         | 限流或連線被拒絕   |

以上是可用免費層的範例，不是永久可用承諾。付費模型價格隨模型、輸入輸出類型和帳單等級變化，升級前逐項查看價格頁，不自動轉為付費。

## Gemini Free API 的輪詢

Aries 按已設定順序嘗試模型，暫時跳過限流或每日額度用完的模型；成功後停止。預設模型清單也要以目前專案可用性核對。專案級額度由 Key 共用，換 Key 不能繞過限額；RPD 在太平洋時間午夜重設。

## 音色與安全

TTS 使用服務提供的音色清單（如 Kore、Puck）；是否免費取決於模型與帳單等級，不取決於音色名稱。Live 目前不支援日語。免費層請求和回答可能用於改進 Google 產品，勿提交敏感或機密內容。不要公開 Key；僅免費使用時不要啟用付費帳單。

## 常見問題

-   400 / 模型不相容：核對模型用途與模型 ID。
-   403 / 地區不支援：確認支援地區、帳戶資格及 Key 權限。
-   429：查看模型的 RPM、TPM、RPD；先等待，不反覆點選測試。
-   404：模型可能停用，換為控制台目前可用的免費模型。

價格以官方頁面為準。

[價格與免費層](https://ai.google.dev/gemini-api/docs/pricing) · [限額說明](https://ai.google.dev/gemini-api/docs/rate-limits) · [API Key](https://ai.google.dev/gemini-api/docs/api-key) · [使用條款與資料](https://ai.google.dev/gemini-api/terms)
