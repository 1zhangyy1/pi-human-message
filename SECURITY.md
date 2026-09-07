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

Without `PI_HUMAN_MESSAGE_WEBHOOK_URL`, the installable extension uses only the current interactive Pi terminal and makes no Human Message network request. The message text still belongs to the Pi session and is subject to the model provider, transcript storage, and local-machine security already chosen by the user.

When `PI_HUMAN_MESSAGE_WEBHOOK_URL` is set, the installable extension accepts its route-bound external destination only from that trusted configuration. Use HTTPS outside localhost, keep `PI_HUMAN_MESSAGE_WEBHOOK_TOKEN` in a secret manager or process environment, and make the receiving endpoint enforce idempotency and authorization. Do not put credentials in the URL. An invalid explicit Webhook URL fails closed and is never treated as permission to display the message somewhere else.

Terminal rendering is presentation, not delivery authorization. It does not hide Pi's normal assistant output, tools, or errors, and it must not be used to conceal sensitive operations from the person running Pi.

## Supported versions

While the project is pre-1.0, security fixes are made on the latest released minor version only.
