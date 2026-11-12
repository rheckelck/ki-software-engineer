import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-book-pagination',
  host: { class: 'block' },
  templateUrl: './book-pagination.component.html'
})
export class BookPaginationComponent {
  readonly currentPage = input.required<number>();
  readonly pages = input.required<readonly number[]>();
  readonly pageChange = output<number>();
}
