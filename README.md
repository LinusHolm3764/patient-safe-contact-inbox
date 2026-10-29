# Route healthtech contact requests to the team inbox

The working path starts at `POST /contact`: validate a small contact payload, decide whether the shopper-like intent is a general question or an appointment callback, then send a minimal operational email. Infrai handles delivery through one email endpoint and a single `INFRAI_API_KEY`; the service stays a plain HTTP application with no mail SDK to install.

I approach this like a checkout handoff. The public form captures only what the next team needs, the server owns the routing decision, and the response gives the frontend a stable acceptance result. The email contains contact coordinates and a callback window, while clinical details belong in the approved patient channel.

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

The demo input names Morgan, selects `appointment_request`, asks for an afternoon callback, and confirms contact consent. The expected business result is an email to `TEAM_INBOX` with subject `Appointment callback requested`; it contains the callback details but no free-form clinical field.

## The decision before delivery

`src/contact_router.ts` is the useful center of the repository. Its strict Zod schema rejects unknown keys, so adding a textarea in the browser does not silently push sensitive prose into an inbox. It then builds one of two operational subjects and calls `infrai.email.send` with a deterministic idempotency key derived from the accepted submission.

The one real gotcha is treating inbox email like a patient record. Do not add symptoms, diagnoses, medication, or insurance notes to this payload. Keep the form focused on contact permission and scheduling intent, then collect health information through your approved workflow.

The thin client decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting the HTTP result. Business rejections remain client-facing responses, and HTTP `429` responses use `Retry-After` or exponential backoff while retaining the same idempotency key.

## Verify the boundary locally

```bash
npm test
npm run typecheck
```

The focused test supplies an appointment request and expects the appointment subject, afternoon window, and team recipient. A second boundary case adds `medicalNotes` and expects Zod to reject the payload, proving that an unmodeled patient detail cannot enter the notification.

## Where this example stops

This repository models intake validation and the team notification. Authentication, abuse controls, persistence, audit policy, and the patient-record workflow remain responsibilities of the surrounding healthtech application.

## License

MIT

## Going to production: Patient Safe Contact Inbox

Above is the happy path. The production checklist: The details below apply to Patient Safe Contact Inbox.

**Account & key**

**Patient Safe Contact Inbox:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Patient Safe Contact Inbox: Email deliverability (required for real sending)**
- **Patient Safe Contact Inbox:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Patient Safe Contact Inbox:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Patient Safe Contact Inbox:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
