import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * The remote's own copy of the API contract (`AssistantContracts.cs`). It deliberately does not import
 * `@shop/shared/data-access`: that would couple the remote's release to the host's code.
 */
export interface AssistantProduct {
  id: number;
  name: string;
  slug: string;
  brand: string;
  categoryName: string;
  price: number;
  stockQuantity: number;
}

export interface AssistantAnswer {
  answer: string;
  products: AssistantProduct[];
  provider: string;
  degraded: boolean;
}

/** An earlier turn: the server accepts the question and the ids of the products shown, never the answer text. */
export interface AssistantTurn {
  question: string;
  productIds: number[];
}

@Injectable({ providedIn: 'root' })
export class AssistantApi {
  private readonly http = inject(HttpClient);

  /** Anonymous endpoint: the remote never sees the host's access token. */
  ask(apiBase: string, question: string, history: readonly AssistantTurn[] = []): Observable<AssistantAnswer> {
    return this.http.post<AssistantAnswer>(`${apiBase}/api/assistant/ask`, { question, history });
  }
}
