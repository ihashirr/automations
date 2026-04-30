# Meta WhatsApp Webhook

This folder is the Vercel webhook service for the Meta WhatsApp Cloud API.

## Live Endpoint

Callback URL:

```text
https://meta-setup.vercel.app/api/webhook
```

Verify token:

```text
mytoken
```

## What It Does

- Handles Meta webhook verification through `GET /api/webhook`.
- Receives WhatsApp webhook events through `POST /api/webhook`.
- Replies `hi` whenever an incoming WhatsApp user message is received.
- Ignores message status updates such as `sent`, `delivered`, and `read`.
- Logs raw webhook payloads and WhatsApp send API responses in Vercel logs.

## Required Vercel Environment Variables

```text
WHATSAPP_ACCESS_TOKEN
```

Optional:

```text
WHATSAPP_VERIFY_TOKEN=mytoken
WHATSAPP_GRAPH_VERSION=v25.0
```

The access token is stored in Vercel as a sensitive production environment variable. Do not commit local `.env` files.

## Deploy

Run from this folder:

```powershell
vercel --prod --yes
```

## Check Logs

```powershell
vercel logs https://meta-setup.vercel.app --no-follow --since 10m --expand --no-branch
```

## Local Files

```text
api/webhook.js
```

Main webhook function.

```text
api/.env
```

Local-only secret source. This file is ignored by git.
