# Gemini / Google AI Studio setup guide

## What it is and who it suits

Free-tier models for translation, TTS, and Live speech. Gemini Developer API is separate from Cloud Translation, Vision, and Cloud Text-to-Speech.

## Setup

1. Sign in to [AI Studio](https://aistudio.google.com/) and check age/account eligibility and [supported regions](https://ai.google.dev/gemini-api/docs/available-regions).
2. Under [API Keys](https://aistudio.google.com/api-keys), create/import a project and choose “Create API key”. Free-tier usage does not require paid billing.
3. Add Gemini Free API, Gemini translation, Gemini TTS, or Gemini Live in Aries and paste the key.
4. Open [project rate limits](https://aistudio.google.com/rate-limit) for each model's RPM, TPM, and RPD. Official limits are now account-specific; this guide does not invent fixed numbers.
5. Check “Standard / Free Tier” on the [pricing page](https://ai.google.dev/gemini-api/docs/pricing) and select a model ID for the intended task.

## Free-tier examples

| Task / model ID                                          | Free tier          | Minute / daily cap      | After limit                                |
| -------------------------------------------------------- | ------------------ | ----------------------- | ------------------------------------------ |
| Translation: `gemini-3.1-flash-lite`, `gemini-3.7-flash` | Standard available | Project RPM / TPM / RPD | Rate limited; paid tiers billed separately |
| TTS: `gemini-3.8-flash-lite-tts`                         | Available          | Project model limits    | Rate limited; previews consume quota       |
| Live: `gemini-3.8-live`                                  | Available          | Project model limits    | Rate limit / rejected connection           |

These are examples, not a permanent availability promise. Paid prices depend on model, input/output type, and tier. Review official pricing before enabling billing; Aries does not upgrade automatically.

## Free API rotation

Aries tries configured models in order, temporarily skipping rate-limited or exhausted models, and stops on success. Check even the default list against current project access. Keys share project-level limits; additional keys do not bypass quotas. RPD resets at midnight Pacific time.

## Voices and safety

TTS voices include Kore and Puck; free eligibility depends on the model and billing tier. Live currently excludes Japanese. Free-tier requests and responses may improve Google products: avoid sensitive content. Keep keys private and leave paid billing disabled for free-only use.

## Common issues

-   400: check model compatibility with the task.
-   403: check region eligibility and key permissions.
-   429: inspect RPM/TPM/RPD, wait, and avoid repeated tests.
-   404: choose an available free model if the old model is retired.

Official prices take precedence.

[Pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) · [API keys](https://ai.google.dev/gemini-api/docs/api-key) · [Terms and data use](https://ai.google.dev/gemini-api/terms)
