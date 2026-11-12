import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Presentation only: the owning feature decides the heading, message, and retry behavior. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-request-error',
  host: { class: 'block rounded-lg bg-subtle p-8', role: 'alert' },
  template: `
    <ng-content />
    @if (retryable()) {
      <button
        type="button"
        (click)="retry.emit()"
        class="mt-6 rounded-md bg-blue-700 px-5 py-2 text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        Retry
      </button>
    }
  `
})
export class RequestErrorComponent {
  readonly retryable = input(false);
  readonly retry = output<void>();
}
