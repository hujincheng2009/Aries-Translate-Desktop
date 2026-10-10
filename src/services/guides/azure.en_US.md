# Microsoft Azure setup guide

## What it is and who it suits

Official Translator, Speech, and OCR. Each service requires the right resource type; keys and endpoints are not interchangeable across Translator, Speech, Vision, and Document Intelligence.

## Setup

1. Create an [Azure account](https://azure.microsoft.com/free/), complete identity/payment-card verification, and open the [portal](https://portal.azure.com/).
2. Choose “Create a resource” and search for Translator, Speech, Computer Vision / Azure AI Vision, or Document Intelligence.
3. Select subscription, resource group, and region. **Choose F0 (Free)**. If unavailable, check regional/subscription eligibility before accepting S0/S1. Usually one free resource per service type is allowed per subscription.
4. Open the resource's “Keys and Endpoint” page and copy its key, region, and endpoint.
5. Translator uses key and region. Speech uses key and region, with an optional custom endpoint as described by the form. For Azure OCR, first select Vision Read or Document Read, then enter the matching resource key and root endpoint.
6. Save and test a short text or small image. Tests consume quota; Vision transactions differ from Document Intelligence pages.

## F0 allowances and overage

| Service               | Free / month         | Rate limits                                             | After quota / paid tier                        |
| --------------------- | -------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| Translator            | 2 million characters | 2 million/hour, spread evenly; about 33,300/minute      | F0 rejects; S1 and other paid plans are billed |
| Speech neural TTS     | 500,000 characters   | 20 transactions / 60 seconds                            | F0 rejects; S0 bills from the first character  |
| Vision                | 5,000 transactions   | 20/minute                                               | F0 rejects; S1 billed separately               |
| Document Intelligence | 500 pages            | First two pages/request on F0; see official rate limits | F0 rejects; S0 billed per page                 |

Quotas are separate. Paid quotes depend on region, currency, and agreement; public price pages can show placeholders. Check the portal before upgrading. This guide recommends F0 only.

## Voices and models

Choose ordinary neural voices returned by Speech for your language. Custom voices, personal voices, and avatars are outside these recommended free features.

## Cost and security

Check that the resource itself is on F0; trial credit alone is not F0. Exhausting F0 does not automatically upgrade it, but other subscription resources can still incur charges. Keep keys private, rotate them when necessary, and match the resource region.

## Common issues

-   401/403: mismatched key, region, endpoint, or resource type.
-   429: monthly or rate quota reached; lower concurrency and check usage.
-   OCR 404: wrong engine/resource or a full API path pasted as endpoint.
-   Only two document pages: the Document Intelligence F0 limit.

[Document Intelligence limits](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/service-limits?view=doc-intel-4.0.0)

Official prices take precedence.

[Translator pricing](https://azure.microsoft.com/en-us/pricing/details/translator/) · [Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/) · [Vision pricing](https://azure.microsoft.com/en-us/pricing/details/computer-vision/) · [Document Intelligence pricing](https://azure.microsoft.com/en-us/pricing/details/document-intelligence/) · [Translator limits](https://learn.microsoft.com/en-us/azure/ai-services/translator/service-limits) · [Speech limits](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits)
