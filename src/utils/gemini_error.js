import { nextPacificMidnight } from './tts_fallback.js';

export function classifyGeminiHttpError(status, data, now = Date.now()) {
    let body = data;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body);
        } catch {}
    }
    const response = Array.isArray(body) ? body[0] : body;
    const error = response?.error ?? response;
    const details = Array.isArray(error?.details) ? error.details : [];
    const remoteMessage = String(error?.message ?? '');
    const remoteStatus = error?.status;
    const code = Number(status);
    const daily =
        details.some(
            (detail) =>
                /google\.rpc\.QuotaFailure/.test(detail?.['@type'] ?? '') &&
                detail.violations?.some((v) => /PerDay/i.test(`${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`))
        ) || /per day/i.test(remoteMessage);
    const kind =
        details.some((d) => d?.reason === 'API_KEY_INVALID') || code === 401 || code === 403
            ? 'auth'
            : code === 402
              ? 'billing'
              : code === 400 && remoteStatus === 'FAILED_PRECONDITION'
                ? 'region'
                : code === 429 && daily
                  ? 'quota_daily'
                  : code === 429
                    ? 'rate_limited'
                    : code === 400 && /thinking level .* not supported/i.test(remoteMessage)
                      ? 'thinking_unsupported'
                      : code === 400
                        ? 'invalid_request'
                        : code === 404
                          ? 'not_found'
                          : [500, 503, 504].includes(code)
                            ? 'unavailable'
                            : 'other';
    const result = { code, kind, remoteStatus, remoteMessage, limitZero: /limit:\s*0(?![\d.])/i.test(remoteMessage) };
    if (kind === 'quota_daily') result.resetAt = nextPacificMidnight(now) + 60_000;
    if (kind === 'rate_limited') {
        const retry = details.find((d) => /google\.rpc\.RetryInfo/.test(d?.['@type'] ?? ''));
        const seconds =
            /^(\d+(?:\.\d+)?)s$/.exec(retry?.retryDelay ?? '')?.[1] ??
            /retry in\s+(\d+(?:\.\d+)?)s/i.exec(remoteMessage)?.[1];
        if (seconds !== undefined) result.retryAfterMs = Math.ceil(Number(seconds) * 1000);
    }
    return result;
}
