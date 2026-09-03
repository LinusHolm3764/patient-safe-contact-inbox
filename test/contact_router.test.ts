import assert from "node:assert/strict";
import test from "node:test";
import { buildTeamNotification, contactFormSchema } from "../src/contact_router.js";

test("appointment requests are marked for callback without clinical details", () => {
  const contact = contactFormSchema.parse({
    name: "Morgan Lee",
    email: "morgan@example.com",
    phone: "+1 555 010 2040",
    reason: "appointment_request",
    callbackWindow: "afternoon",
    consentToContact: true,
  });

  const notification = buildTeamNotification(contact, "care-team@example.com");

  assert.equal(notification.subject, "Appointment callback requested");
  assert.equal(notification.to, "care-team@example.com");
  assert.match(notification.text, /Preferred callback window: afternoon/);
  assert.doesNotMatch(notification.text, /symptom|diagnosis|medication/i);
});

test("the request boundary rejects unmodeled patient details", () => {
  const result = contactFormSchema.safeParse({
    name: "Morgan Lee",
    email: "morgan@example.com",
    phone: "+1 555 010 2040",
    reason: "appointment_request",
    callbackWindow: "afternoon",
    consentToContact: true,
    medicalNotes: "private detail",
  });

  assert.equal(result.success, false);
});
