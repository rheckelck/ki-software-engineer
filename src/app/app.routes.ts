import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./books/book-list.component').then(m => m.BookListComponent)
  },
  { path: 'books/:id', loadComponent: () => import('./books/book-detail.component').then(m => m.BookDetailComponent) },
  { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) },
  { path: '**', redirectTo: '' }
];
