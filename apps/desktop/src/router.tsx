import { AppView } from './types/app';

export const routes: Array<{ path: string; view: AppView; label: string }> = [
  { path: '/', view: 'dashboard', label: 'Dashboard' },
  { path: '/login', view: 'login', label: 'Login' },
  { path: '/register', view: 'register', label: 'Register' },
  { path: '/settings', view: 'settings', label: 'Settings' },
];
