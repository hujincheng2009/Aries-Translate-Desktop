# Microsoft Azure 開通指南

## 這是什麼、適合誰

官方 Translator、Speech 與 OCR。它們需要各自類型的資源；翻譯、語音、Vision、Document Intelligence 的 Key 與端點不可隨意混用。

## 開通步驟

1. 註冊 [Azure 帳戶](https://azure.microsoft.com/free/)，按要求完成身分與信用卡驗證，再開啟 [Azure 入口網站](https://portal.azure.com/)。
2. 點選「建立資源」，分別搜尋 Translator、Speech、Computer Vision / Azure AI Vision，或 Document Intelligence。
3. 選擇訂用帳戶、資源群組和區域，**定價層選擇 F0（免費）**。沒有 F0 時先核對該區域與訂用資格，不要預設接受 S0 / S1。每個訂用帳戶每種服務通常只能建立一個免費資源。
4. 建立完成後開啟資源 →「金鑰與端點」，複製該資源的 Key、區域、端點。
5. Translator：填 Key 與區域；Speech：填 Key 與區域，自訂端點按提示填寫。Azure OCR：先選擇 Vision Read 或 Document Read，再填相應資源的 Key 和根端點。
6. 儲存後自行測試短文字或小截圖。測試也消耗額度；Vision 與 Document Intelligence 的統計單位不同。

## F0 額度與超額

| 服務                  | 月免費額度 | 速率限制                                     | 用完後 / 付費                |
| --------------------- | ---------- | -------------------------------------------- | ---------------------------- |
| Translator            | 200 萬字元 | 200 萬字元 / 小時，均勻使用，約 33300 / 分鐘 | F0 拒絕呼叫；S1 等另收費     |
| Speech 神經網路語音   | 50 萬字元  | 20 次 / 60 秒                                | F0 拒絕呼叫；S0 從首字元計費 |
| Vision                | 5000 次    | 20 次 / 分鐘                                 | F0 拒絕呼叫；S1 另收費       |
| Document Intelligence | 500 頁     | F0 單次僅處理前兩頁；速率見官方限制          | F0 拒絕呼叫；S0 按頁計費     |

上述各服務額度分別計算。Azure 價格頁的付費金額依區域、貨幣和合約變化，公開頁面可能顯示預留位置；升級前以入口網站報價為準。本指南只推薦 F0。

## 音色與模型

Speech 選擇 F0 可用的標準神經網路音色，如服務清單回傳的中文、英語音色。自訂語音、個人語音、虛擬人像等不屬於這裡推薦的免費範圍。

## 省錢與安全

確認資源實際層級為 F0，而不只是「帳戶有試用金」。用完 F0 額度不會自動切換為付費，須主動升級資源；訂用帳戶中的其他資源仍可能收費。保持 Key 私密，停用時可輪替金鑰；區域必須與資源一致。

## 常見問題

-   401 / 403：Key、區域、端點或資源類型不匹配。
-   429：達到月額度或速率限制，降低並行数並查看用量。
-   OCR 404：引擎與資源不對應，或端點誤含完整 API 路徑。
-   OCR 文件只處理兩頁：這是 Document Intelligence F0 的限制。

[Document Intelligence 限制](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0)

價格以官方頁面為準。

[Translator 價格](https://azure.microsoft.com/en-us/pricing/details/translator/) · [Speech 價格](https://azure.microsoft.com/en-us/pricing/details/speech/) · [Vision 價格](https://azure.microsoft.com/en-us/pricing/details/computer-vision/) · [Document Intelligence 價格](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/) · [Translator 限制](https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits) · [Speech 限制](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits)
