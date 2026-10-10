# Google Cloud 開通指南

## 這是什麼、適合誰

適合需要官方翻譯、語音或文字辨識 API 的使用者。Aries 翻譯使用 Basic v2 的 NMT；Google OCR 使用 Cloud Vision，不使用 Gemini Key。

## 開通步驟

1. 開啟 [Google Cloud 控制台](https://console.cloud.google.com/)，在頂端專案選單選擇「建立專案」，記下專案 ID。
2. 進入 [帳單](https://console.cloud.google.com/billing)，按帳戶要求綁定付款方式並將專案連結至帳單帳戶。免費額度內不收費，超額可自動收費。
3. 開啟 API 程式庫，分別啟用 [Cloud Translation API](https://console.cloud.google.com/apis/library/translate.googleapis.com)、[Cloud Text-to-Speech API](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)、[Cloud Vision API](https://console.cloud.google.com/apis/library/vision.googleapis.com)。只啟用要用的服務。
4. 在 [憑證](https://console.cloud.google.com/apis/credentials) 點選「建立憑證 → API 金鑰」，再編輯 Key，在「API 限制」選擇要用的 API。不同服務可使用個別 Key。
5. 在 Aries 的對應服務貼上 Key。翻譯填 API Key；OCR 填 API Key；語音選擇 API Key 驗證並填「憑證」。不要把 AI Studio Key 填到這裡。
6. 進入 [配額與系統限制](https://console.cloud.google.com/iam-admin/quotas)，按 API 篩選，將可調整的請求或字元配額降低至實際需要的上限。並非每項都有「每日」配額。
7. 啟用 [預算通知](https://console.cloud.google.com/billing/budgets)。預算通知不是消費硬上限，不能保證阻止扣費；控制用量須配合 API 配額。

## 月免費額度與超額價格

| 服務 / 系列                    | 月免費額度      | 超額價格（USD）           | 備註                                           |
| ------------------------------ | --------------- | ------------------------- | ---------------------------------------------- |
| Translation NMT                | 50 萬字元       | $20 / 百萬字元            | Basic / Advanced 共用 $10 抵扣，不適用文件翻譯 |
| TTS Standard / WaveNet         | 合計 400 萬字元 | $4 / 百萬字元             | 同一 SKU，共用額度                             |
| TTS Neural2 / Polyglot         | 合計 100 萬字元 | $16 / 百萬字元            | 同一 SKU，共用額度                             |
| TTS Chirp 3 HD                 | 100 萬字元      | $30 / 百萬字元            | 獨立系列                                       |
| TTS Studio                     | 100 萬字元      | $160 / 百萬字元           | 超額昂貴，少量使用                             |
| Vision Text Detection          | 1000 單位       | $1.50 / 1000 單位（首級） | 每圖 / 每頁按功能計單位                        |
| Vision Document Text Detection | 1000 單位       | $1.50 / 1000 單位（首級） | 與上列按各功能分別計量                         |

## 免費額度內可選的音色

按 Standard、WaveNet、Neural2、Polyglot、Chirp 3 HD、Studio 系列選擇；具體語言與音色以服務回傳清單為準。此表不包括沒有月免費額度的系列。語音試聽也計字元。

## 省錢與安全設定

只給 Key 啟用所需 API；桌面程式使用前核對應用程式限制是否適合你的環境。切勿把 Key 傳到聊天、截圖或公開儲存庫。一個專案建立多個 Key 不會增加共用免費額度。

## 常見問題

-   403：檢查帳單、API 是否啟用，以及 Key 的限制。
-   429：查看字元、請求配額；降低並行數，等額度恢復。
-   找不到音色：重新載入清單，核對語言、系列與帳戶權限。

價格以官方頁面為準。

[Translation 價格](https://cloud.google.com/translate/pricing) · [TTS 價格](https://cloud.google.com/text-to-speech/pricing) · [Vision 價格](https://cloud.google.com/vision/pricing) · [API Key 限制](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys) · [預算說明](https://cloud.google.com/billing/docs/how-to/budgets)
