/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_API_URL: string;
  readonly VITE_AUTH_SERVICE_URL: string;
  readonly VITE_AUTH_FRONT_URL: string;
  readonly VITE_SHELL_FRONT_URL: string;
  readonly VITE_PUBLIC_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
