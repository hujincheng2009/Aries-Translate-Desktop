const SECRET_FIELD = /key|secret|token|password|authorization|app[_-]?id|client[_-]?id|credential/i;

export function redactServiceError(error, config = {}) {
    let detail = typeof error === 'string' ? error : error?.message ?? String(error ?? '');
    const secrets = Object.entries(config ?? {})
        .filter(([key, value]) => SECRET_FIELD.test(key) && typeof value === 'string' && value.trim())
        .flatMap(([, value]) => [value, encodeURIComponent(value)]);
    for (const secret of secrets.sort((a, b) => b.length - a.length)) detail = detail.split(secret).join('[REDACTED]');
    return detail
        .replace(/(Bearer\s+)[^\s"',}]+/gi, '$1[REDACTED]')
        .replace(
            /((?:\bkey|\btoken|\bsecret|api[_-]?key|access[_-]?token|client[_-]?secret|authorization|ocp-apim-subscription-key|x-goog-api-key)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi,
            '$1[REDACTED]'
        )
        .replace(/([?&](?:key|token|secret|api_key|access_token)=)[^&\s"']+/gi, '$1[REDACTED]')
        .slice(0, 4000);
}

// Return i18n keys; the same diagnosis can be shown in every interface language.
export function explainServiceError(error, provider) {
    const message = typeof error === 'string' ? error : error?.message ?? String(error ?? '');
    const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
    const has = (code) => status === code || new RegExp(`\\b${code}\\b`).test(message);
    const balanceMessage = /insufficient[_ ](?:quota|balance|credit)|balance|credit.*exhaust|余额|餘額|欠费|欠費/i;
    // Services that know which setting caused the error (OpenAI) pass fieldKey/param; the form marks that field.
    const field = { fieldKey: error?.fieldKey ?? null, values: { param: error?.param ?? '' } };
    if (error?.code === 'invalid_json')
        return {
            kind: 'bad_request',
            messageKey: 'services.errors.invalid_json',
            adviceKey: 'services.errors.invalid_json_advice',
            ...field,
            values: { error: error.detail ?? '' },
        };
    // Errors that already located the parameter (they carry fieldKey, possibly null) are parameter problems even when
    // the text mentions "token" (e.g. max_tokens). Other services keep the text rules: Google reports bad keys as 400.
    const located = error && typeof error === 'object' && 'fieldKey' in error;
    if (located && (status === 400 || status === 422) && !balanceMessage.test(message))
        return {
            kind: 'bad_request',
            messageKey: 'services.errors.bad_request',
            adviceKey:
                field.fieldKey === 'requestArguments' && error?.param
                    ? 'services.errors.bad_request_arguments_advice'
                    : field.fieldKey === 'reasoning'
                      ? 'services.errors.bad_request_reasoning_advice'
                      : 'services.errors.bad_request_advice',
            ...field,
        };
    let kind = 'other';
    if (
        /(?:region|country|location).*(?:not.support|unsupported|unavailable)|(?:not.support|unsupported|unavailable).*(?:region|country|location)|地区不支持|地區不支援|region.*blocked/i.test(
            message
        )
    )
        kind = 'region';
    else if (has(402) || balanceMessage.test(message)) kind = 'balance';
    else if (has(401) || /unauthenticated|invalid.*(?:key|token)|authentication/i.test(message)) kind = 'unauthorized';
    else if (has(403) || /permission.denied|forbidden|access.denied/i.test(message)) kind = 'forbidden';
    else if (has(404) || /model.*not.*found|not.found/i.test(message)) kind = 'not_found';
    else if (has(429) || /resource.exhausted|rate.?limit|quota.exceeded|too.many.requests/i.test(message))
        kind = 'rate_limit';
    else if (
        /invalid_request_error|unsupported.parameter|unrecognized.request.argument|unsupported.value/i.test(message)
    )
        kind = 'bad_request';
    else if (/timeout|timed.out|aborterror|etimedout|超时|逾時/i.test(message)) kind = 'timeout';
    else if (/fetch.failed|failed.to.fetch|network|connect|dns|enotfound|网络|網路/i.test(message)) kind = 'network';
    else if (/required|missing|must.*(?:enter|provide)|不能为空|必填/i.test(message)) kind = 'required';
    return {
        kind,
        messageKey: `services.errors.${kind}`,
        adviceKey:
            kind === 'forbidden' && ['google_cloud', 'azure'].includes(provider)
                ? `services.errors.${provider}_forbidden_advice`
                : `services.errors.${kind}_advice`,
    };
}
