/** 32 hex characters; satisfies the API's ^[A-Za-z0-9_-]{8,64}$ rule. */
export function createIdempotencyKey(): string {
  return crypto.randomUUID().replaceAll('-', '');
}
