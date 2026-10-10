# Google Cloud setup guide

## What it is and who it suits

Official translation, speech, and OCR APIs. Aries translation uses Basic v2 NMT; Google OCR uses Cloud Vision, separate from Gemini AI Studio.

## Setup

1. Open [Cloud Console](https://console.cloud.google.com/), choose “New project” in the project menu, and note the project ID.
2. Open [Billing](https://console.cloud.google.com/billing), complete payment verification, and link the project. Usage above free allowances can incur charges automatically.
3. Enable only the APIs you need: [Translation](https://console.cloud.google.com/apis/library/translate.googleapis.com), [Text-to-Speech](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com), and [Vision](https://console.cloud.google.com/apis/library/vision.googleapis.com).
4. Under [Credentials](https://console.cloud.google.com/apis/credentials), choose “Create credentials → API key”. Edit the key and restrict it to the required APIs. Separate keys can be used for different services.
5. Paste the key into the matching Aries service. Translation and OCR use API Key fields; speech uses the API Key authentication option and Credential field. AI Studio keys belong to Gemini services.
6. In [Quotas and System Limits](https://console.cloud.google.com/iam-admin/quotas), filter by API and reduce adjustable character or request limits. Not every API exposes daily quotas.
7. Set [budget alerts](https://console.cloud.google.com/billing/budgets). Alerts are not a hard spending cap; combine them with API quota controls.

## Monthly allowance and overage

| Service / family               | Free / month                  | Overage USD                      | Notes                                                             |
| ------------------------------ | ----------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| Translation NMT                | 500,000 characters            | $20 / million                    | Shared Basic / Advanced $10 credit; excludes document translation |
| Standard / WaveNet             | 4 million characters combined | $4 / million                     | Shared SKU                                                        |
| Neural2 / Polyglot             | 1 million characters combined | $16 / million                    | Shared SKU                                                        |
| Chirp 3 HD                     | 1 million characters          | $30 / million                    | Separate family                                                   |
| Studio                         | 1 million characters          | $160 / million                   | Expensive overage                                                 |
| Vision Text Detection          | 1,000 units                   | $1.50 / 1,000 at first paid tier | One unit per image/page and feature                               |
| Vision Document Text Detection | 1,000 units                   | $1.50 / 1,000 at first paid tier | Metered separately by feature                                     |

## Voice choices

Select Standard, WaveNet, Neural2, Polyglot, Chirp 3 HD, or Studio voices from the returned language list. Families without monthly free allowance are omitted. Speech previews also count toward usage.

## Cost and security

Restrict the key to required APIs and check application restrictions for desktop use. Keep credentials out of chats, screenshots, and public repositories. Extra keys in one project do not multiply shared allowances.

## Common issues

-   403: check billing, enabled APIs, and key restrictions.
-   429: inspect character/request quotas, reduce concurrency, and wait.
-   Missing voice: reload the voice list and check language, family, and access.

Official prices take precedence.

[Translation pricing](https://cloud.google.com/translate/pricing) · [TTS pricing](https://cloud.google.com/text-to-speech/pricing) · [Vision pricing](https://cloud.google.com/vision/pricing) · [Key restrictions](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys) · [Budget documentation](https://cloud.google.com/billing/docs/how-to/budgets)
