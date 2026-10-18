import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AssistantAnswer } from './assistant-api';
import { AssistantWidget, EXAMPLE_QUESTIONS } from './assistant-widget';

const answer: AssistantAnswer = {
  answer: 'These products match your question: Sonora Buds 3 by Sonora (Audio).',
  products: [{ id: 7, name: 'Sonora Buds 3', slug: 'sonora-buds-3', brand: 'Sonora', categoryName: 'Audio', price: 129.99, stockQuantity: 0 }],
  provider: 'Mock',
  degraded: false,
};

const followUpAnswer: AssistantAnswer = { ...answer, answer: 'Sonora Buds 3 is the lighter one.' };

describe('AssistantWidget', () => {
  function render(apiBase = '') {
    TestBed.configureTestingModule({
      imports: [AssistantWidget],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(AssistantWidget);
    fixture.componentRef.setInput('apiBase', apiBase);
    // ShadowDom encapsulation: the template lives in the host's shadow root.
    const root = () => (fixture.nativeElement as HTMLElement).shadowRoot as ShadowRoot;
    return { fixture, root, http: TestBed.inject(HttpTestingController) };
  }

  type Rendered = ReturnType<typeof render>;

  async function type({ fixture, root }: Rendered, question: string) {
    await fixture.whenStable();
    const input = root().querySelector('textarea') as HTMLTextAreaElement;
    input.value = question;
    input.dispatchEvent(new Event('input'));
    return input;
  }

  async function ask(rendered: Rendered, question: string) {
    await type(rendered, question);
    rendered.root().querySelector('form')?.dispatchEvent(new Event('submit'));
    await rendered.fixture.whenStable();
  }

  const texts = (root: ShadowRoot, selector: string) => Array.from(root.querySelectorAll(selector)).map((e) => e.textContent?.trim());

  it('drops its own heading in compact mode but keeps an accessible name', async () => {
    const { fixture, root } = render();
    fixture.componentRef.setInput('compact', '');
    await fixture.whenStable();

    expect(root().querySelector('h2')).toBeNull();
    expect(root().querySelector('section')?.getAttribute('aria-label')).toBe('Ask the shopping assistant');
  });

  it('shows the question and the answer as messages, with products and database prices', async () => {
    const rendered = render('https://shop.example');
    const { fixture, root, http } = rendered;

    await ask(rendered, '  sonora earbuds  ');
    const request = http.expectOne('https://shop.example/api/assistant/ask');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ question: 'sonora earbuds', history: [] });
    expect(texts(root(), '[data-testid="assistant-question"]')).toEqual(['You: sonora earbuds']);
    expect(root().querySelector('[role="status"]')?.textContent).toContain('Searching');
    expect((root().querySelector('textarea') as HTMLTextAreaElement).value).toBe('');

    request.flush(answer);
    await fixture.whenStable();

    expect(root().querySelector('[data-testid="assistant-answer"]')?.textContent).toContain('Sonora Buds 3');
    const item = root().querySelector('li')?.textContent ?? '';
    expect(item).toContain('$129.99');
    expect(item).toContain('Sold out');
  });

  it('keeps earlier turns on screen and sends them as history with a follow-up question', async () => {
    const rendered = render();
    const { fixture, root, http } = rendered;

    await ask(rendered, 'sonora earbuds');
    http.expectOne('/api/assistant/ask').flush(answer);
    await fixture.whenStable();
    await ask(rendered, 'which of them is lighter?');
    const followUp = http.expectOne('/api/assistant/ask');

    // Only the question and the shown product ids go back to the server, never the answer text.
    expect(followUp.request.body).toEqual({
      question: 'which of them is lighter?',
      history: [{ question: 'sonora earbuds', productIds: [7] }],
    });
    followUp.flush(followUpAnswer);
    await fixture.whenStable();

    expect(texts(root(), '[data-testid="assistant-question"]')).toEqual(['You: sonora earbuds', 'You: which of them is lighter?']);
    expect(texts(root(), '[data-testid="assistant-answer"]')).toEqual([answer.answer, followUpAnswer.answer]);
  });

  it('emits the product slug when a suggestion is opened', async () => {
    const rendered = render();
    const selected: string[] = [];
    rendered.fixture.componentInstance.productSelected.subscribe((slug) => selected.push(slug));

    await ask(rendered, 'sonora earbuds');
    rendered.http.expectOne('/api/assistant/ask').flush(answer);
    await rendered.fixture.whenStable();
    rendered.root().querySelector<HTMLButtonElement>('.assistant__products li button')?.click();

    expect(selected).toEqual(['sonora-buds-3']);
  });

  it('does not call the API for a too short question', async () => {
    const rendered = render();

    await ask(rendered, 'tv');

    rendered.http.expectNone('/api/assistant/ask');
    expect(rendered.root().textContent).toContain('at least 3 characters');
  });

  it('sends on Enter, adds a line on Shift+Enter and waits for the pending answer before the next question', async () => {
    const rendered = render();
    const { fixture, root, http } = rendered;

    const input = await type(rendered, 'first question');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
    await fixture.whenStable();
    http.expectNone('/api/assistant/ask');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    const first = http.expectOne('/api/assistant/ask');
    expect(root().querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);

    await ask(rendered, 'second question');
    http.expectNone('/api/assistant/ask');
    first.flush(answer);
  });

  it('explains failures in plain words and retries the same question', async () => {
    const rendered = render();
    const { fixture, root, http } = rendered;

    await ask(rendered, 'sonora earbuds');
    http.expectOne('/api/assistant/ask').flush({ code: 'too_many_requests' }, { status: 429, statusText: 'Too Many Requests' });
    await fixture.whenStable();
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('wait a minute');

    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.includes('Try again'))?.click();
    await fixture.whenStable();
    const retry = http.expectOne('/api/assistant/ask');
    expect(retry.request.body).toEqual({ question: 'sonora earbuds', history: [] });
    retry.flush(null, { status: 503, statusText: 'Unavailable' });
    await fixture.whenStable();

    expect(texts(root(), '[data-testid="assistant-question"]')).toHaveLength(1);
    expect(root().querySelector('[role="alert"]')?.textContent).toContain('unavailable');
  });

  it('starts a new conversation and cancels the answer still in flight', async () => {
    const rendered = render();
    const { fixture, root, http } = rendered;

    await ask(rendered, 'sonora earbuds');
    const pending = http.expectOne('/api/assistant/ask');
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.includes('New conversation'))?.click();
    await fixture.whenStable();

    expect(pending.cancelled).toBe(true);
    expect(root().querySelectorAll('[data-testid="assistant-question"]')).toHaveLength(0);
    expect(root().querySelector('[aria-label="Example questions"]')).not.toBeNull();
  });

  it('asks an example question with one click', async () => {
    const { fixture, root, http } = render();
    await fixture.whenStable();

    root().querySelector<HTMLButtonElement>('[aria-label="Example questions"] button')?.click();
    await fixture.whenStable();

    expect(http.expectOne('/api/assistant/ask').request.body).toEqual({ question: EXAMPLE_QUESTIONS[0], history: [] });
  });
});
