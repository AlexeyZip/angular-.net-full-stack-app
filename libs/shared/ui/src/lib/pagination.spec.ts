import { TestBed } from '@angular/core/testing';
import { Pagination, pageWindow } from './pagination';

describe('pageWindow', () => {
  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [5, 10, [1, null, 4, 5, 6, null, 10]],
    [2, 10, [1, 2, 3, null, 10]],
    [10, 10, [1, null, 9, 10]],
  ])('page %d of %d -> %j', (page, total, expected) => {
    expect(pageWindow(page, total)).toEqual(expected);
  });
});

describe('Pagination', () => {
  const render = async (page: number, totalPages: number) => {
    const fixture = TestBed.createComponent(Pagination);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('totalPages', totalPages);
    await fixture.whenStable();
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((p) => emitted.push(p));
    return { element: fixture.nativeElement as HTMLElement, emitted };
  };

  it('renders nothing for a single page', async () => {
    const { element } = await render(1, 1);
    expect(element.querySelector('nav')).toBeNull();
  });

  it('marks the current page for assistive technology and emits page changes', async () => {
    const { element, emitted } = await render(2, 5);

    expect(element.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('2');
    const buttons = Array.from(element.querySelectorAll('button'));
    buttons.find((b) => b.textContent?.trim() === '3')?.click();
    buttons.find((b) => b.textContent?.includes('Next page'))?.click();
    buttons.find((b) => b.textContent?.trim() === '2')?.click(); // current page: no event

    expect(emitted).toEqual([3, 3]);
  });

  it('disables "previous" on the first page', async () => {
    const { element } = await render(1, 5);
    const previous = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Previous page'));
    expect(previous?.disabled).toBe(true);
  });
});
