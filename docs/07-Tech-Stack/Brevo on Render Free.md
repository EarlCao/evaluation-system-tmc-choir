---
tags: [deployment, email]
---
# Brevo on Render Free

The application supports Brevo transactional email over HTTPS (port 443), compatible
with Render Free's SMTP restrictions. The backend class is
`apps.core.email_backend.BrevoEmailBackend`. No Google OAuth tokens or SMTP keys are
used by this backend. Brevo's Free plan currently includes 300 sends per day.

## 1. Create and activate your Brevo account

Sign up at [Brevo](https://www.brevo.com/), verify your account email, and complete
account onboarding. Open the Transactional area and check that transactional sending
is active. If Brevo reports that the platform is not activated or is disabled, follow
its activation instructions or request activation through Brevo support. A valid API
key alone does not activate a suspended or unapproved sending account.

## 2. Add and verify the sender

Open the account dropdown, then **Settings > Senders, Domains, IPs > Senders**.
Choose **Add a sender**. Use `TMC Choir` for the sender name and an email address you
control for the sender email. Save and enter the verification code Brevo emails you.
Use this exact verified email address for `DEFAULT_FROM_EMAIL` in Render.

A Gmail sender can be individually verified. Brevo may rewrite free-domain sender
addresses to a Brevo-managed domain for deliverability. For permanent use, Brevo
recommends authenticating a domain you own. The deployed `vercel.app` address is not
an email mailbox or a domain you can authenticate by adding its DNS records.

## 3. Create an API key

Open **Settings > SMTP & API > API Keys & MCP**, select **Generate a new API key**,
and name it `TMC Choir Render`. Copy the key privately. Select the API Keys tab,
not SMTP. Do not create an MCP key for the application. Keep the key in Render only;
never add it to Vercel frontend variables, source control, chat, or screenshots.

## 4. Configure the existing Render backend

Deploy a commit containing `BrevoEmailBackend`. In Render, select the backend service,
open **Environment > Edit**, and configure these exact keys:

```dotenv
EMAIL_BACKEND=apps.core.email_backend.BrevoEmailBackend
BREVO_API_KEY=<your private Brevo API key>
DEFAULT_FROM_EMAIL=<your exact sender email verified in Brevo>
```

Save and redeploy, then wait for Live. Existing Gmail OAuth/SMTP values are unused
when this backend is explicitly selected and can be removed after switching. If a
worker is configured to send email, give it the same backend, API key and sender;
the Blueprint shares them. Other backend environment variables must stay configured.
The Blueprint still has worker/disk resources and is not an entirely Free hosting plan.

## 5. Verify and troubleshoot

Submit registration once, check the recipient inbox and Spam folder, and complete
OTP verification. In Brevo, open Transactional email logs to inspect delivery.
No marketing campaign, recipient contact import, or email template is needed for OTPs.
API acceptance is not proof of inbox delivery; Brevo account activation, verified
sender, daily credits, suppression/bounce rules and recipient delivery still apply.

A failed API request logs only safe diagnostics in Render, for example:

```text
Brevo API delivery failed: endpoint=send_message status=401 reason=unauthorized
```

Share that line if delivery fails. It omits API keys, addresses and OTPs. HTTP 401
suggests checking the API key; 400/403 require checking the verified sender, account
activation and any account/API access restrictions. Never share the key itself.
Server failures do not consume the hourly registration allowance; rapid retries
remain limited to ten per minute. Successful and invalid requests retain three per hour.

## Sources

- [Brevo transactional email API](https://developers.brevo.com/docs/send-a-transactional-email)
- [Create a verified sender](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender)
- [Create an API key](https://help.brevo.com/hc/en-us/articles/209467485-Create-and-manage-your-API-keys)
- [Sending requirements and sender rewriting](https://help.brevo.com/hc/en-us/articles/14925263522578-Comply-with-Gmail-Yahoo-and-Microsoft-s-requirements-for-email-senders)
- [Account activation and delivery troubleshooting](https://help.brevo.com/hc/en-us/articles/115000188150-Troubleshooting-Issues-with-Brevo-SMTP)
- [Free daily send limit](https://help.brevo.com/hc/en-us/articles/8292912279954-Add-or-remove-emails-from-your-plan)

Related: [[Accounts]] · [[Core]] · [[Security Model]] · [[Gmail on Render Free]]
