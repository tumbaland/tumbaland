export interface SmokeApp {
  name: string;
  url: string;
  /** Text that only renders once the app has booted and its data has loaded. */
  heading: RegExp;
}

/** Every frontend dev server the smoke suite boots and checks. */
export const apps: SmokeApp[] = [
  { name: 'shell-front', url: 'http://localhost:3000/', heading: /Write end-to-end tests/ },
  { name: 'relationship-front', url: 'http://localhost:3001/', heading: /Overview of your time together/ },
  { name: 'album-front', url: 'http://localhost:3002/', heading: /View Albums/ },
  { name: 'finance-front', url: 'http://localhost:3003/', heading: /Your net worth, asset allocation and investments at a glance/ },
  { name: 'auth-front', url: 'http://localhost:3004/', heading: /Welcome back, Test User!/ },
  { name: 'payment-front', url: 'http://localhost:3005/', heading: /Choose Your Plan/ },
  { name: 'group-front', url: 'http://localhost:3006/', heading: /Groups/ },
  { name: 'account-front', url: 'http://localhost:3007/', heading: /Account Settings/ }
];
