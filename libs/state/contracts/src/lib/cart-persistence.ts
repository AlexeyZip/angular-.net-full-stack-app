import { Injectable } from '@angular/core';
import { CartLine, clampQuantity } from './state-contracts';

interface PersistedCart {
  readonly version: 1;
  /** Owner of this cart: guarantees one user never sees another user's stale cart on a shared device. */
  readonly owner: string;
  readonly lines: readonly CartLine[];
}

const KEY_PREFIX = 'shop.cart.v1';
const GUEST = 'guest';

/**
 * Persists the cart in localStorage, scoped per user. Only product ids, quantities and display data are
 * stored - no tokens, no personal data. Everything read back is validated, because storage is user-editable.
 */
@Injectable({ providedIn: 'root' })
export class CartPersistence {
  read(userId: string | null): CartLine[] {
    const owner = userId ?? GUEST;
    try {
      const raw = localStorage.getItem(this.key(owner));
      if (!raw) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedCart(parsed) || parsed.owner !== owner) {
        this.clear(userId);
        return [];
      }

      return parsed.lines.map((line) => ({ ...line, quantity: clampQuantity(line.quantity) }));
    } catch {
      return [];
    }
  }

  write(userId: string | null, lines: readonly CartLine[]): void {
    const owner = userId ?? GUEST;
    try {
      if (lines.length === 0) {
        localStorage.removeItem(this.key(owner));
        return;
      }

      const value: PersistedCart = { version: 1, owner, lines };
      localStorage.setItem(this.key(owner), JSON.stringify(value));
    } catch {
      // Storage full or disabled (private mode): the cart still works in memory.
    }
  }

  clear(userId: string | null): void {
    try {
      localStorage.removeItem(this.key(userId ?? GUEST));
    } catch {
      // ignore
    }
  }

  private key(owner: string): string {
    return `${KEY_PREFIX}:${owner}`;
  }
}

function isPersistedCart(value: unknown): value is PersistedCart {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<PersistedCart>;
  return candidate.version === 1 && typeof candidate.owner === 'string' && Array.isArray(candidate.lines) && candidate.lines.every(isCartLine);
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const line = value as Record<string, unknown>;
  return (
    Number.isInteger(line['productId']) &&
    Number.isInteger(line['quantity']) &&
    typeof line['name'] === 'string' &&
    typeof line['slug'] === 'string' &&
    typeof line['unitPriceSnapshot'] === 'number' &&
    (line['imageUrl'] === null || typeof line['imageUrl'] === 'string')
  );
}

/**
 * Computes the cart to show after the signed-in identity changes. Shared by both state variants.
 * - Sign-in: the guest cart is merged into the user's saved cart, then the guest copy is removed.
 * - Sign-out / session expiry: the previous user's saved cart is deleted (shared-device privacy)
 *   and the (normally empty) guest cart is shown.
 */
export function cartForIdentityChange(persistence: CartPersistence, previousUserId: string | null, nextUserId: string | null): CartLine[] {
  if (previousUserId !== null) {
    persistence.clear(previousUserId);
  }

  if (nextUserId === null) {
    return persistence.read(null);
  }

  const merged = mergeCarts(persistence.read(nextUserId), persistence.read(null));
  persistence.clear(null);
  persistence.write(nextUserId, merged);
  return merged;
}

/** Items added before signing in are kept by adding their quantities to the user's saved cart. */
export function mergeCarts(userLines: readonly CartLine[], guestLines: readonly CartLine[]): CartLine[] {
  const merged = new Map<number, CartLine>(userLines.map((line) => [line.productId, line]));
  for (const line of guestLines) {
    const existing = merged.get(line.productId);
    merged.set(line.productId, existing ? { ...existing, quantity: clampQuantity(existing.quantity + line.quantity) } : line);
  }
  return [...merged.values()];
}
