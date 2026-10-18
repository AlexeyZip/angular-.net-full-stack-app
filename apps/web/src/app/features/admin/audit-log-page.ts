import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AdminApi, errorOf, LOADING, loadable, valueOf } from '@shop/shared/data-access';
import { EmptyState, ErrorState, Pagination, Spinner } from '@shop/shared/ui';
import { switchMap } from 'rxjs';

@Component({
  selector: 'shop-admin-audit-log-page',
  imports: [DatePipe, EmptyState, ErrorState, Pagination, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Audit log</h1>
    <p class="shop-muted">Every administrative change, written in the same database transaction as the change itself.</p>
    @switch (state().status) {
      @case ('loading') {
        <shop-spinner label="Loading audit log" />
      }
      @case ('error') {
        <shop-error-state [message]="errorMessage()" (retry)="reload.update((n) => n + 1)" />
      }
      @case ('success') {
        @if (result(); as result) {
          @if (result.totalCount === 0) {
            <shop-empty-state title="No administrative actions yet" />
          } @else {
            <div class="shop-table-wrapper">
              <table class="shop-table">
                <thead>
                  <tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">Details</th></tr>
                </thead>
                <tbody>
                  @for (entry of result.items; track entry.id) {
                    <tr data-testid="audit-row">
                      <td>{{ entry.createdAt | date: 'short' }}</td>
                      <td>{{ entry.actorEmail }}</td>
                      <td><code>{{ entry.action }}</code></td>
                      <td>{{ entry.entityType }} #{{ entry.entityId }}</td>
                      <td><code class="details">{{ entry.details }}</code></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <shop-pagination [page]="page()" [totalPages]="result.totalPages" (pageChange)="page.set($event)" />
          }
        }
      }
    }
  `,
  styles: `
    .details { font-size: 0.8rem; word-break: break-word; }
  `,
})
export class AuditLogPage {
  private readonly api = inject(AdminApi);
  protected readonly page = signal(1);
  protected readonly reload = signal(0);
  private readonly query = computed(() => ({ page: this.page(), reload: this.reload() }));
  protected readonly state = toSignal(toObservable(this.query).pipe(switchMap(({ page }) => loadable(this.api.auditLog(page)))), {
    initialValue: LOADING,
  });
  protected readonly result = computed(() => valueOf(this.state()));
  protected readonly errorMessage = computed(() => errorOf(this.state())?.message ?? '');
}
