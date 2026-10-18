import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button, EmptyState } from '@shop/shared/ui';

@Component({
  selector: 'shop-not-found-page',
  imports: [RouterLink, Button, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <shop-empty-state title="Page not found" message="The page you are looking for does not exist or has moved.">
      <a shopButton routerLink="/">Go to the home page</a>
    </shop-empty-state>
  `,
})
export class NotFoundPage {}
