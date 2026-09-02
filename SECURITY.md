# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository. If that option is unavailable, contact the maintainer through the GitHub profile before sharing sensitive details.

Include the affected version, impact, reproduction steps, and whether any real credential or user data was involved. Revoke exposed credentials immediately; a code change cannot make an already disclosed secret private again.

## Security boundary

`pi-human-message` is a behavior and delivery-interface library. Its prompt is not an authorization or isolation boundary.

The host application must enforce:

- authenticated conversation and tenant ownership;
- trusted binding of destination, thread, and reply ids;
- idempotent external side effects and retries;
- tool authorization and confirmation for risky actions;
- message and turn rate limits;
- channel-specific size, escaping, and content rules;
- transcript retention, encryption, deletion, and redaction;
- model/provider data-handling policy.

The model receives only message text for `send_message`; it must never be allowed to choose the recipient from untrusted prompt content.

The installable extension accepts its route-bound destination only from `PI_HUMAN_MESSAGE_WEBHOOK_URL`. Use HTTPS outside localhost, keep `PI_HUMAN_MESSAGE_WEBHOOK_TOKEN` in a secret manager or process environment, and make the receiving endpoint enforce idempotency and authorization. Do not put credentials in the URL.

## Supported versions

While the project is pre-1.0, security fixes are made on the latest released minor version only.
