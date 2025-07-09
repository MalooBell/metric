import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./app.component').then(m => m.AppComponent)
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];