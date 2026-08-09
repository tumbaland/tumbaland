/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FINANCE_API_URL: string;
  readonly VITE_AUTH_SERVICE_URL: string;
  readonly VITE_AUTH_FRONT_URL: string;
  readonly VITE_GROUP_API_URL: string;
  readonly VITE_ACCOUNT_FRONT_URL: string;
  readonly VITE_SHELL_FRONT_URL: string;
  readonly VITE_PAYMENT_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
