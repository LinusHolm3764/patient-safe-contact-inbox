import { createHash } from "node:crypto";
import { z } from "zod";
import type { InfraiClient, SentEmail } from "./infrai.js";

export const contactFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email().max(254),
  phone: z.string().trim().min(7).max(30),
  reason: z.enum(["general_question", "appointment_request"]),
  callbackWindow: z.enum(["morning", "afternoon", "evening"]),
  consentToContact: z.literal(true),
}).strict();

export type ContactForm = z.infer<typeof contactFormSchema>;

type TeamNotification = {
  to: string;
  subject: string;
  body: string;
  /** @deprecated Use body. Kept as a non-serialized compatibility view. */
  readonly text: string;
};

export function buildTeamNotification(contact: ContactForm, teamInbox: string): TeamNotification {
  const appointment = contact.reason === "appointment_request";
  const body = [
    `Request type: ${appointment ? "appointment callback" : "general question"}`,
    `Name: ${contact.name}`,
    `Email: ${contact.email}`,
    `Phone: ${contact.phone}`,
    `Preferred callback window: ${contact.callbackWindow}`,
    "Contact consent: confirmed",
    "Collect clinical details through the approved patient channel during follow-up.",
  ].join("\n");
  const notification = {
    to: teamInbox,
    subject: appointment
      ? "Appointment callback requested"
      : "New healthtech contact request",
    body,
  };
  Object.defineProperty(notification, "text", { value: body, enumerable: false });
  return notification as TeamNotification;
}

export async function routeContact(
  rawContact: unknown,
  teamInbox: string,
  infrai: InfraiClient,
): Promise<SentEmail> {
  const contact = contactFormSchema.parse(rawContact);
  const notification = buildTeamNotification(contact, teamInbox);
  const submissionKey = createHash("sha256")
    .update(JSON.stringify(contact))
    .digest("hex");
  return infrai.email.send(notification, `contact-${submissionKey}`);
}
