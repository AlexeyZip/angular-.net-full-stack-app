import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { AssistantAnswer, AssistantApi, AssistantTurn } from './assistant-api';

interface ChatTurn {
  readonly id: number;
  readonly question: string;
  readonly status: 'pending' | 'answered' | 'failed';
  readonly answer?: AssistantAnswer;
  readonly error?: string;
}

interface AskRequest {
  readonly id: number;
  readonly question: string;
  readonly history: AssistantTurn[];
}

export const MIN_QUESTION_LENGTH = 3;
export const MAX_QUESTION_LENGTH = 500;
/** Matches `AssistantLimits.MaxHistoryTurns` on the server. */
export const MAX_HISTORY_TURNS = 4;
/** The conversation lives only in memory; old turns are dropped so a long session cannot grow without bound. */
export const MAX_TURNS = 50;

export const EXAMPLE_QUESTIONS = ['Headphones under $300', 'A laptop for video editing', 'A monitor for my home office'];

/**
 * Rendered as the custom element `<shop-assistant>`. Its public contract with any host page:
 * - attribute `api-base` (input `apiBase`): origin of the Shop API, empty for same-origin;
 * - boolean attribute `compact`: render without the widget's own card, filling the host's height;
 * - DOM event `productSelected` (output) with the product slug in `event.detail`.
 * Shadow DOM isolates its styles in both directions; it only reads the host's `--shop-*` CSS custom
 * properties (which do cross the shadow boundary) and falls back to its own values without them.
 *
 * The conversation is kept in this component only (not in storage: questions may contain personal data), so it
 * survives as long as the host keeps the element alive and is gone after a reload.
 */
@Component({
  selector: 'shop-assistant-widget',
  imports: [ReactiveFormsModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `
    <section
      class="assistant"
      [class.assistant--compact]="compact()"
      [attr.aria-labelledby]="compact() ? null : 'assistant-title'"
      [attr.aria-label]="compact() ? 'Ask the shopping assistant' : null"
    >
      @if (!compact() || turns().length) {
        <div class="assistant__toolbar">
          @if (!compact()) {
            <h2 id="assistant-title">Ask the shopping assistant</h2>
          }
          @if (turns().length) {
            <button type="button" class="assistant__text-button" (click)="newConversation()">New conversation</button>
          }
        </div>
      }

      <!-- tabindex: a scrollable region must be reachable by keyboard to scroll it. -->
      <div #log class="assistant__log" role="log" aria-label="Conversation" tabindex="0">
        <div class="message message--assistant">
          <p>
            Hi! Tell me what you are looking for: a type of product, a brand or a budget. You can ask follow-up
            questions such as “which of them is in stock?”. I only suggest products from our catalog, and prices and
            stock always come from the shop's database.
          </p>
          @if (!turns().length) {
            <ul class="assistant__examples" aria-label="Example questions">
              @for (example of examples; track example) {
                <li>
                  <button type="button" class="assistant__chip" (click)="askExample(example)">{{ example }}</button>
                </li>
              }
            </ul>
          }
        </div>

        @for (turn of turns(); track turn.id) {
          <div class="message message--user" data-testid="assistant-question">
            <span class="visually-hidden">You: </span>{{ turn.question }}
          </div>
          <div class="message message--assistant">
            <span class="visually-hidden">Assistant: </span>
            @switch (turn.status) {
              @case ('pending') {
                <p role="status" class="assistant__typing">
                  <span class="visually-hidden">Searching the catalog…</span>
                  <span aria-hidden="true" class="dot"></span><span aria-hidden="true" class="dot"></span
                  ><span aria-hidden="true" class="dot"></span>
                </p>
              }
              @case ('failed') {
                <p class="assistant__error" role="alert">{{ turn.error }}</p>
                <button type="button" class="assistant__text-button" [disabled]="pending()" (click)="retry(turn)">
                  Try again
                </button>
              }
              @case ('answered') {
                @if (turn.answer; as result) {
                  @if (result.degraded) {
                    <p class="assistant__notice">The assistant could not answer; showing matching products instead.</p>
                  }
                  <p class="assistant__answer" data-testid="assistant-answer">{{ result.answer }}</p>
                  @if (result.products.length) {
                    <ul class="assistant__products" aria-label="Suggested products">
                      @for (product of result.products; track product.id) {
                        <li>
                          <div>
                            <strong>{{ product.name }}</strong>
                            <span class="assistant__muted">{{ product.brand }} · {{ product.categoryName }}</span>
                          </div>
                          <span>{{ product.price | currency: 'USD' }}</span>
                          <span class="assistant__muted">{{ product.stockQuantity > 0 ? 'In stock' : 'Sold out' }}</span>
                          <button type="button" class="assistant__link" (click)="productSelected.emit(product.slug)">
                            View {{ product.name }}
                          </button>
                        </li>
                      }
                    </ul>
                  }
                  <p class="assistant__muted">Answered by: {{ result.provider }}</p>
                }
              }
            }
          </div>
        }
      </div>

      <form class="assistant__composer" (submit)="$event.preventDefault(); submit()">
        <label for="assistant-question" class="visually-hidden">Your question</label>
        <div class="assistant__row">
          <textarea
            #input
            id="assistant-question"
            rows="1"
            autocomplete="off"
            placeholder="Ask about products…"
            aria-describedby="assistant-keys"
            [formControl]="question"
            [attr.maxlength]="maxLength"
            [attr.aria-invalid]="question.invalid && question.dirty"
            (keydown.enter)="sendOnEnter($event)"
          ></textarea>
          <button type="submit" [disabled]="pending()">Send</button>
        </div>
        <p id="assistant-keys" class="visually-hidden">Enter sends, Shift+Enter adds a new line.</p>
        @if (question.invalid && question.dirty) {
          <p class="assistant__hint">Ask a question of at least {{ minLength }} characters.</p>
        }
      </form>
    </section>
  `,
  styles: `
    :host {
      /* Host theme tokens with this widget's fallbacks, resolved once. */
      --accent: var(--shop-color-primary, #4338ca);
      --line: var(--shop-color-border, #dcdfe8);
      --muted: var(--shop-color-text-muted, #5b6275);
      --warn: var(--shop-color-warning, #b54708);
      display: flex;
      flex-direction: column;
      min-height: 0;
      container-type: inline-size;
      font-family: var(--shop-font-sans, system-ui, sans-serif);
      color: var(--shop-color-text, #1c1f2a);
    }
    .assistant {
      flex: 1;
      min-height: 0;
      height: min(70vh, 640px);
      display: flex;
      flex-direction: column;
      background: var(--shop-color-surface, #fff);
      border: 1px solid var(--line);
      border-radius: var(--shop-radius-lg, 16px);
      overflow: hidden;
    }
    .assistant--compact {
      height: auto;
      background: transparent;
      border: 0;
      border-radius: 0;
    }
    .assistant__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--line);
    }
    .assistant--compact .assistant__toolbar { justify-content: flex-end; }
    h2 { margin: 0; font-size: var(--shop-font-size-lg, 1.25rem); }
    .assistant__log {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
    }
    .message {
      max-width: 88%;
      padding: 0.625rem 0.875rem;
      border-radius: 14px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .message p { margin: 0; }
    .message :is(p, ul) + :is(p, ul) { margin-top: 0.5rem; }
    .message--user {
      align-self: flex-end;
      white-space: pre-wrap;
      background: var(--accent);
      color: var(--shop-color-on-primary, #fff);
      border-bottom-right-radius: 4px;
    }
    .message--assistant {
      align-self: flex-start;
      background: var(--shop-color-surface-muted, #f0f1f6);
      border-bottom-left-radius: 4px;
    }
    .assistant__composer {
      padding: 0.75rem 1rem 1rem;
      border-top: 1px solid var(--line);
      background: var(--shop-color-surface, #fff);
    }
    .assistant__row { display: flex; gap: 0.5rem; align-items: flex-end; }
    textarea {
      flex: 1;
      font: inherit;
      color: inherit;
      resize: none;
      field-sizing: content;
      min-height: 2.5rem;
      max-height: 8rem;
      box-sizing: border-box;
      background: var(--shop-color-bg, #f7f7fb);
      border: 1px solid var(--line);
      border-radius: var(--shop-radius-sm, 6px);
      padding: 0.5rem 0.75rem;
    }
    button {
      font: inherit;
      cursor: pointer;
      border: 0;
      border-radius: var(--shop-radius-sm, 6px);
      padding: 0.5rem 1rem;
      background: var(--accent);
      color: var(--shop-color-on-primary, #fff);
    }
    button:disabled { opacity: 0.6; cursor: progress; }
    :focus-visible { outline: 3px solid var(--shop-color-focus, #f59e0b); outline-offset: 2px; }
    .assistant__text-button {
      background: transparent;
      color: var(--accent);
      padding: 0.25rem 0.5rem;
    }
    .assistant__examples { list-style: none; padding: 0; margin: 0.75rem 0 0; display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .assistant__chip {
      background: var(--shop-color-surface, #fff);
      color: var(--accent);
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 0.375rem 0.75rem;
      font-size: var(--shop-font-size-sm, 0.875rem);
    }
    .assistant__products { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
    .assistant__products li {
      display: grid;
      grid-template-columns: 1fr auto auto auto;
      gap: 0.75rem;
      align-items: center;
      padding: 0.75rem;
      border-radius: var(--shop-radius-md, 10px);
      background: var(--shop-color-surface, #fff);
    }
    .assistant__products li div { display: grid; }
    .assistant__link { background: transparent; color: var(--accent); text-decoration: underline; padding: 0; }
    .assistant__muted { color: var(--muted); font-size: var(--shop-font-size-sm, 0.875rem); }
    .assistant__error { color: var(--shop-color-danger, #b42318); }
    .assistant__hint, .assistant__notice { color: var(--warn); }
    .assistant__hint { margin: 0.25rem 0 0; }
    .assistant__typing { display: flex; gap: 0.25rem; padding: 0.25rem 0; }
    .dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 50%;
      background: var(--muted);
      animation: blink 1.2s infinite ease-in-out;
    }
    .dot:nth-child(3) { animation-delay: 0.2s; }
    .dot:nth-child(4) { animation-delay: 0.4s; }
    @keyframes blink { 0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .dot { animation: none; opacity: 0.6; } }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    /* Narrow hosts such as a side panel: name on its own row, then price, stock and link. */
    @container (max-width: 480px) {
      .message { max-width: 92%; }
      .assistant__products li { grid-template-columns: auto 1fr; }
      .assistant__products li div { grid-column: 1 / -1; }
      .assistant__products li .assistant__link { grid-column: 1 / -1; justify-self: start; }
    }
  `,
})
export class AssistantWidget {
  private readonly api = inject(AssistantApi);
  private readonly log = viewChild.required<ElementRef<HTMLElement>>('log');
  private readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>('input');

  readonly apiBase = input('');
  /** Boolean attribute `compact`: no own card and heading, for hosts that provide them (e.g. a side panel). */
  readonly compact = input(false, { transform: booleanAttribute });
  readonly productSelected = output<string>();

  protected readonly minLength = MIN_QUESTION_LENGTH;
  protected readonly maxLength = MAX_QUESTION_LENGTH;
  protected readonly examples = EXAMPLE_QUESTIONS;
  protected readonly question = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(MIN_QUESTION_LENGTH), Validators.maxLength(MAX_QUESTION_LENGTH)],
  });

  protected readonly turns = signal<readonly ChatTurn[]>([]);
  protected readonly pending = computed(() => this.turns().some((turn) => turn.status === 'pending'));

  private nextId = 0;
  // `null` cancels the request in flight (new conversation); switchMap also cancels it on a retry.
  private readonly requests = new Subject<AskRequest | null>();

  constructor() {
    this.requests
      .pipe(
        switchMap((request) => (request ? this.send(request) : EMPTY)),
        takeUntilDestroyed(),
      )
      .subscribe(({ id, update }) => this.updateTurn(id, update));

    // Keep the newest message in view whenever a turn is added or changes state.
    afterRenderEffect(() => {
      this.turns();
      const log = this.log().nativeElement;
      log.scrollTop = log.scrollHeight;
    });
  }

  protected submit(): void {
    this.question.markAsDirty();
    if (this.question.invalid || this.pending()) {
      return;
    }
    const question = this.question.value.trim();
    this.question.reset();
    this.start(question);
  }

  protected sendOnEnter(event: Event): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) {
      return;
    }
    event.preventDefault();
    this.submit();
  }

  protected askExample(question: string): void {
    if (!this.pending()) {
      this.start(question);
      this.input().nativeElement.focus();
    }
  }

  protected retry(turn: ChatTurn): void {
    if (this.pending()) {
      return;
    }
    this.updateTurn(turn.id, { status: 'pending', error: undefined });
    this.requests.next({ id: turn.id, question: turn.question, history: this.historyBefore(turn.id) });
  }

  protected newConversation(): void {
    this.requests.next(null);
    this.turns.set([]);
    this.question.reset();
    this.input().nativeElement.focus();
  }

  private start(question: string): void {
    const id = ++this.nextId;
    const history = this.historyBefore(id);
    this.turns.update((turns) => [...turns, { id, question, status: 'pending' as const }].slice(-MAX_TURNS));
    this.requests.next({ id, question, history });
  }

  /** Answered turns before `id`, as the server expects them: questions and shown product ids only. */
  private historyBefore(id: number): AssistantTurn[] {
    return this.turns()
      .filter((turn) => turn.id < id && turn.status === 'answered')
      .slice(-MAX_HISTORY_TURNS)
      .map((turn) => ({ question: turn.question, productIds: turn.answer?.products.map((product) => product.id) ?? [] }));
  }

  private send(request: AskRequest): Observable<{ id: number; update: Partial<ChatTurn> }> {
    return this.api.ask(this.apiBase(), request.question, request.history).pipe(
      map((answer) => ({ id: request.id, update: { status: 'answered' as const, answer } })),
      catchError((error: unknown) => of({ id: request.id, update: { status: 'failed' as const, error: messageFor(error) } })),
    );
  }

  private updateTurn(id: number, update: Partial<ChatTurn>): void {
    this.turns.update((turns) => turns.map((turn) => (turn.id === id ? { ...turn, ...update } : turn)));
  }
}

function messageFor(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 429) {
      return 'Too many questions in a short time. Please wait a minute and try again.';
    }
    if (error.status === 400) {
      return 'Please rephrase your question.';
    }
  }
  return 'The assistant is unavailable right now. Please try again later.';
}
