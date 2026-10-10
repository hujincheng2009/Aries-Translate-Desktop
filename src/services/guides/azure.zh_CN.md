# Microsoft Azure 开通指南

## 这是什么、适合谁

官方 Translator、Speech 与 OCR。它们需要各自类型的资源；翻译、语音、Vision、Document Intelligence 的 Key 与终结点不可随意混用。

## 开通步骤

1. 注册 [Azure 账户](https://azure.microsoft.com/free/)，按要求完成身份与银行卡验证，然后打开 [Azure 门户](https://portal.azure.com/)。
2. 点击“创建资源”，分别搜索 Translator、Speech、Computer Vision / Azure AI Vision，或 Document Intelligence。
3. 选择订阅、资源组和区域，**定价层选择 F0（免费）**。没有 F0 时先核对该区域与订阅资格，不要默认接受 S0 / S1。每个订阅每种服务通常只能创建一个免费资源。
4. 创建完成后打开资源 →“密钥和终结点”，复制该资源的 Key、区域、终结点。
5. Translator：填 Key 与区域；Speech：填 Key 与区域，自定义终结点按提示填写。Azure OCR：先选择 Vision Read 或 Document Read，再填相应资源的 Key 和根终结点。
6. 保存后自行测试短文本或小截图。测试也消耗额度；Vision 与 Document Intelligence 的统计单位不同。

## F0 额度与超额

| 服务                  | 月免费额度 | 速率限制                                     | 用完后 / 付费                |
| --------------------- | ---------- | -------------------------------------------- | ---------------------------- |
| Translator            | 200 万字符 | 200 万字符 / 小时，均匀使用，约 33300 / 分钟 | F0 拒绝调用；S1 等另收费     |
| Speech 神经网络语音   | 50 万字符  | 20 次 / 60 秒                                | F0 拒绝调用；S0 从首字符计费 |
| Vision                | 5000 次    | 20 次 / 分钟                                 | F0 拒绝调用；S1 另收费       |
| Document Intelligence | 500 页     | F0 单次仅处理前两页；速率见官方限制          | F0 拒绝调用；S0 按页计费     |

上述各服务额度分开计算。Azure 价格页的付费金额依区域、货币和合约变化，公开页面可能显示占位符；升级前以门户报价为准。本指南只推荐 F0。

## 音色与模型

Speech 选择 F0 可用的标准神经网络音色，如服务列表返回的中文、英语音色。自定义语音、个人语音、头像等不属于这里推荐的免费范围。

## 省钱与安全

确认资源实际层级为 F0，而不只是“账户有试用金”。用完 F0 额度不会自动切换为付费，需主动升级资源；订阅中的其他资源仍可能收费。保持 Key 私密，停用时可轮换密钥；区域必须与资源一致。

## 常见问题

-   401 / 403：Key、区域、终结点或资源类型不匹配。
-   429：达到月额度或速率限制，降低并发并查看用量。
-   OCR 404：引擎与资源不对应，或终结点误含完整 API 路径。
-   OCR 文档只处理两页：这是 Document Intelligence F0 的限制。

[Document Intelligence 限制](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0)

价格以官方页面为准。

[Translator 价格](https://azure.microsoft.com/en-us/pricing/details/translator/) · [Speech 价格](https://azure.microsoft.com/en-us/pricing/details/speech/) · [Vision 价格](https://azure.microsoft.com/en-us/pricing/details/computer-vision/) · [Document Intelligence 价格](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/) · [Translator 限制](https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits) · [Speech 限制](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits)
