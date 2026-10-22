---
tags: [deployment, email]
---
# Gmail on Render Free

Render Free blocks outbound SMTP ports 25, 465 and 587. Gmail app passwords do
not remove this restriction. Use the Gmail API over HTTPS (port 443) to keep Gmail
as the sender. No Brevo account or new Python packages are needed.

## Configure Google once

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a
   project and enable **Gmail API** under APIs & Services.
2. Configure the Google Auth Platform consent screen. For a personal Gmail account,
   select External. Add only `https://www.googleapis.com/auth/gmail.send` as the
   requested scope. While testing, add the sender Gmail account as a test user.
3. Create an OAuth client of type **Web application**. Add the authorized redirect URI
   `https://developers.google.com/oauthplayground`.
4. Open [OAuth Playground](https://developers.google.com/oauthplayground/). In its
   settings, enable **Use your own OAuth credentials** and enter that client's ID
   and secret. Use offline access and force consent if a refresh token is not returned.
5. Authorize the scope `https://www.googleapis.com/auth/gmail.send`, signing in as
   the Gmail account that will send the application's verification and reset emails.
   Exchange the authorization code for tokens and copy the **refresh token**.
6. For ongoing use, move the consent screen out of Testing and obtain a fresh token.
   Google limits refresh tokens issued to external apps in Testing to seven days for
   this scope. Follow any Google verification requirements shown for your app.

This authorization belongs to the application sender only. Members do not connect
Google accounts. Keep the client secret and refresh token private; enter them directly
in Render, never in chat, source control, frontend variables, or screenshots.

## Configure the existing Render backend

After deploying the commit containing `GmailEmailBackend`, open the backend service's
**Environment** page and set:

```dotenv
EMAIL_BACKEND=apps.core.email_backend.GmailEmailBackend
GMAIL_CLIENT_ID=<your Google OAuth client ID>
GMAIL_CLIENT_SECRET=<your Google OAuth client secret>
GMAIL_REFRESH_TOKEN=<sender account refresh token>
DEFAULT_FROM_EMAIL=<the Gmail address that authorized the token>
```

Save and redeploy. An explicitly selected backend takes precedence over old
`EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` settings. Those SMTP credentials can be
removed; the Gmail API does not use an app password. If a worker sends emails, give
it the same backend and credentials; the Blueprint shares these settings.
The existing Blueprint includes paid worker/disk resources; changing its email
settings does not make the entire Blueprint a Free deployment.

## Verify delivery

Submit your own registration, confirm receipt of the six-digit code (including Spam),
and complete verification. Check the sender's Gmail Sent folder. If delivery fails,
Render logs contain the exception type without OTPs or OAuth credentials. HTTP 400
from the token endpoint often requires reauthorizing the sender; 401/403 can indicate
invalid authorization, a disabled Gmail API, or missing `gmail.send` permission.
The registration endpoint keeps its generic 503 error and never bypasses verification.
Gmail sending limits still apply. An accepted API message is not proof of inbox delivery.

## Sources

- [Render Free limitations](https://render.com/docs/free#other-limitations)
- [Gmail message sending](https://developers.google.com/workspace/gmail/api/guides/sending)
- [Google OAuth refresh tokens](https://developers.google.com/identity/protocols/oauth2#expiration)
- [OAuth offline access](https://developers.google.com/identity/protocols/oauth2/web-server#offline)

Related: [[Accounts]] · [[Core]] · [[Dev Environment Setup]] · [[Security Model]]
