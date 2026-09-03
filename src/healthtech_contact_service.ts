import { createServer } from "node:http";
import { ZodError } from "zod";
import { createInfraiClient, InfraiError } from "./infrai.js";
import { routeContact } from "./contact_router.js";

const apiKey = process.env.INFRAI_API_KEY;
const teamInbox = process.env.TEAM_INBOX;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");
if (!teamInbox) throw new Error("TEAM_INBOX is required");

const infrai = createInfraiClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/contact") {
    json(res, 404, { error: "Route not found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks).toString("utf8");
    const body: unknown = JSON.parse(rawBody);
    const sent = await routeContact(body, teamInbox, infrai);
    json(res, 202, { accepted: true, message_id: sent.message_id });
  } catch (error) {
    if (error instanceof SyntaxError) {
      json(res, 400, { error: "Request body must be valid JSON" });
    } else if (error instanceof ZodError) {
      json(res, 422, { error: "Invalid contact form", issues: error.issues });
    } else if (error instanceof InfraiError && error.status < 500) {
      json(res, error.status, { error: error.message, code: error.code });
    } else {
      console.error(error);
      json(res, 502, { error: "Notification could not be accepted" });
    }
  }
}).listen(port, () => {
  console.log(`Healthtech contact service listening on http://localhost:${port}`);
});
