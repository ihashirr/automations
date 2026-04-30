# Architecture Pipeline

## Request Flow

```text
WhatsApp user
-> Meta WhatsApp Cloud API
-> Meta webhook subscription: messages
-> Vercel production deployment
-> /api/webhook
-> Meta Graph API send-message endpoint
-> WhatsApp user receives "hi"
```

## Webhook Verification

Meta sends a `GET /api/webhook` request with these query parameters:

```text
hub.mode
hub.verify_token
hub.challenge
```

The function compares `hub.verify_token` with `WHATSAPP_VERIFY_TOKEN`, falling back to `mytoken`. If it matches, the function returns `hub.challenge`.

## Incoming Message Handling

Meta sends incoming WhatsApp messages as:

```text
entry[].changes[].value.messages[]
```

For each message, the function reads:

```text
value.metadata.phone_number_id
message.from
```

It then sends:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "<message.from>",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "hi"
  }
}
```

to:

```text
https://graph.facebook.com/v25.0/<phone_number_id>/messages
```

## Status Event Handling

Delivery events arrive through the same subscribed Meta field, `messages`, but appear as:

```text
entry[].changes[].value.statuses[]
```

Examples:

```text
sent
delivered
read
failed
```

The webhook currently logs these payloads but does not reply to them.

## Runtime Configuration

Production secrets live in Vercel environment variables:

```text
WHATSAPP_ACCESS_TOKEN
```

The local `api/.env` file is only a private source for setup and must stay ignored.

## Operational Checks

1. Send a WhatsApp message to the connected number.
2. Check Vercel logs.
3. Confirm the incoming payload contains `value.messages`.
4. Confirm logs include `WhatsApp reply sent`.
5. Confirm the WhatsApp user receives `hi`.
