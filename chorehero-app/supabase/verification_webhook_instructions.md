# Verification Webhook Setup

This webhook updates cleaner verification and background check status.

## Environment Variables (Supabase Edge Function)
- `VERIFICATION_WEBHOOK_SECRET` — shared secret for inbound requests
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Endpoint
Deploy as `verification-webhook`, then send POST requests to:
`https://<project-ref>.functions.supabase.co/verification-webhook`

## Request Headers
```
x-webhook-secret: <VERIFICATION_WEBHOOK_SECRET>
```

## Payload Examples
Identity verified:
```
{
  "provider": "persona",
  "event": "identity.verified",
  "user_id": "<cleaner-user-uuid>",
  "status": "verified"
}
```

Background check completed:
```
{
  "provider": "checkr",
  "event": "background_check.completed",
  "user_id": "<cleaner-user-uuid>",
  "status": "cleared"
}
```

## Notes
- If all LIVE requirements are met, the auto‑promote trigger will move the cleaner to `LIVE`.
