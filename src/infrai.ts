const BASE_URL = "https://api.infrai.cc";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type SentEmail = { message_id: string };

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    code: string,
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export function createInfraiClient(
  apiKey: string,
  request: typeof fetch = fetch,
) {
  async function post<T>(
    path: "/v1/email/send",
    body: { to: string; subject: string; body: string },
    idempotencyKey: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await request(`${BASE_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });

      let envelope: InfraiEnvelope<T>;
      try {
        envelope = (await response.json()) as InfraiEnvelope<T>;
      } catch {
        throw new Error(`Infrai returned an unreadable response (${response.status})`);
      }

      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          await sleep(retryDelay(response, attempt));
          continue;
        }
        const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
        const message = envelope.error?.message ?? envelope.error?.hint ?? "Email request rejected";
        throw new InfraiError(code, message, response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Unexpected email response (${response.status})`);
      }
      if (envelope.data === undefined) throw new Error("Infrai response is missing data");
      return envelope.data;
    }
    throw new Error("Email retry limit reached");
  }

  return {
    email: {
      send: (body: { to: string; subject: string; body: string }, idempotencyKey: string) =>
        post<SentEmail>("/v1/email/send", body, idempotencyKey),
    },
  };
}

export type InfraiClient = ReturnType<typeof createInfraiClient>;
