/**
 * Human-facing transaction codes. These are what the Flutter app renders as
 * the title of each record, and what the v1 API accepts as `:id`, so the
 * prefixes match the ones the app already shows.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function randomCode(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

export function payinReference(): string {
  return `AP${randomCode(10)}`;
}

export function payoutReference(): string {
  return `LB${randomCode(10)}`;
}

export function depositReference(): string {
  return `TXN${randomCode(10)}`;
}

/** A player-side UTR, used when an admin records a payin without one. */
export function syntheticTxnRef(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let digits = "";
  for (const byte of bytes) digits += (byte % 10).toString();
  return `6289${digits}`;
}

/**
 * Retries `attempt` when a unique-constraint collision on a generated code
 * happens. 36^10 makes this effectively dead code, but a duplicate reference
 * must never surface as a 500.
 */
export async function withUniqueReference<T>(
  attempt: (reference: string) => Promise<T>,
  generate: () => string,
  tries = 5,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await attempt(generate());
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "P2002") throw error;
      lastError = error;
    }
  }
  throw lastError;
}
