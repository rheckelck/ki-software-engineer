import { ChangeDetectionStrategy, Component, input, OnChanges, signal } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-book-cover',
  host: { class: 'block aspect-[3/4] overflow-hidden rounded-lg bg-subtle' },
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" [alt]="title()" (error)="failed.set(true)" class="h-full w-full object-contain" />
    } @else {
      <div class="flex h-full items-center justify-center p-4 text-center text-muted">No cover available</div>
    }
  `
})
export class BookCoverComponent implements OnChanges {
  readonly src = input.required<string>();
  readonly title = input.required<string>();
  protected readonly failed = signal(false);

  ngOnChanges(): void {
    this.failed.set(false);
  }
}
