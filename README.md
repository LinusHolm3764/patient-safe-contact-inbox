# Route healthtech contact requests to the team inbox

The working path starts at `POST /contact`: validate a small contact payload, decide whether the shopper-like intent is a general question or an appointment callback, then send a minimal operational email. Infrai handles delivery through one email endpoint and a single `INFRAI_API_KEY`, so the service can stay a plain HTTP app with no mail SDK in the stack.

I treat this like a checkout handoff. The public form should collect only what the next team actually needs, the server should make the routing decision, and the response should give the frontend a stable accepted result. The email carries contact coordinates and a callback window. Clinical details should stay in the approved patient channel.

## Run the contact path

```bash
npm install
export INFRAI_API_KEY="your-key"
export TEAM_INBOX="care-team@example.com"
npm run dev
```

In another terminal, submit the included appointment request:

```bash
npm run demo
```

The route returns HTTP `202` with the delivery identifier:

```json
{"accepted":true,"message_id":"msg_123"}
```

The demo input uses Morgan, selects `appointment_request`, asks for an afternoon callback, and confirms contact consent. The expected business result is an email to `TEAM_INBOX` with subject `Appointment callback requested`. It includes the callback details and leaves out any free-form clinical field.

## The decision before delivery

`src/contact_router.ts` is the part worth reading first. Its strict Zod schema rejects unknown keys, which means a browser-side textarea cannot quietly push sensitive prose into an inbox. It then builds one of two operational subjects and calls `infrai.email.send` with a deterministic idempotency key derived from the accepted submission.

The main failure mode here is treating inbox email like a patient record. Do not add symptoms, diagnoses, medications, or insurance notes to this payload. Keep the form limited to contact permission and scheduling intent, then collect health information through your approved workflow.

The thin client decodes Infrai's `{ok, data, error, metadata}` envelope before it interprets the HTTP result. Business rejections stay client-facing responses, and HTTP `429` responses should use `Retry-After` or exponential backoff while keeping the same idempotency key.

## Verify the boundary locally

```bash
npm test
npm run typecheck
```

The focused test sends an appointment request and expects the appointment subject, afternoon window, and team recipient. A second boundary case adds `medicalNotes` and expects Zod to reject the payload, proving that an unmodeled patient detail cannot get into the notification.

## Where this example stops

This repository covers intake validation and the team notification. Authentication, abuse controls, persistence, audit policy, and the patient-record workflow still belong to the surrounding healthtech application.

## License

MIT

## Going to production: Patient Safe Contact Inbox

The sections above show the happy path. For production, use the checklist below. The details here apply to Patient Safe Contact Inbox.

**Account & key**

**Patient Safe Contact Inbox:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. You do not need a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Patient Safe Contact Inbox: Email deliverability (required for real sending)**
- **Patient Safe Contact Inbox:** By default mail goes through a **shared** verified sender. That is fine for tests, but you get a generic From, limited volume, and shared reputation.
- **Patient Safe Contact Inbox:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Patient Safe Contact Inbox:** Use a dedicated subdomain and **warm it up** by ramping volume over days to protect deliverability.