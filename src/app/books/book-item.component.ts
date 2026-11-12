import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Book } from './book';
import { BookCoverComponent } from './book-cover.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-book-item',
  imports: [RouterLink, BookCoverComponent],
  templateUrl: './book-item.component.html'
})
export class BookItemComponent {
  readonly book = input.required<Book>();
}
