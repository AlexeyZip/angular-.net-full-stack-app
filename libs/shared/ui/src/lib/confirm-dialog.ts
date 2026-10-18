import { ChangeDetectionStrategy, Component, effect, ElementRef, input, model, output, viewChild } from '@angular/core';
import { Button } from './button';

/**
 * Native <dialog> + showModal(): the browser provides focus trapping, Escape to close, the backdrop
 * and inert background content - no custom overlay library required.
 */
@Component({
  selector: 'shop-confirm-dialog',
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialog class="shop-dialog" [attr.aria-labelledby]="titleId" (close)="open.set(false)">
      <h2 class="shop-dialog__title" [id]="titleId">{{ title() }}</h2>
      <p>{{ message() }}</p>
      <div class="shop-dialog__actions">
        <button shopButton variant="ghost" type="button" (click)="dialog.close()">{{ cancelLabel() }}</button>
        <button shopButton [variant]="danger() ? 'danger' : 'primary'" type="button" (click)="confirm()">{{ confirmLabel() }}</button>
      </div>
    </dialog>
  `,
})
export class ConfirmDialog {
  private static nextId = 0;
  protected readonly titleId = `shop-dialog-title-${ConfirmDialog.nextId++}`;

  readonly open = model(false);
  readonly title = input.required<string>();
  readonly message = input('');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Cancel');
  readonly danger = input(false);
  readonly confirmed = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Synchronizing a signal with an imperative DOM API is a legitimate use of effect().
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) {
        element.showModal();
      } else if (!this.open() && element.open) {
        element.close();
      }
    });
  }

  protected confirm(): void {
    this.confirmed.emit();
    this.open.set(false);
  }
}
