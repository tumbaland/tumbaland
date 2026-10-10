/// <reference types="vite/client" />

/** The release this build was cut from. Set by `define` in vite.config.mts. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_ALBUM_API_URL: string
  readonly VITE_AUTH_SERVICE_URL: string
  readonly VITE_AUTH_FRONT_URL: string
  readonly VITE_FINANCE_API_URL: string
  readonly VITE_RELATIONSHIP_FRONT_URL: string
  readonly VITE_ALBUM_FRONT_URL: string
  readonly VITE_FINANCE_FRONT_URL: string
  readonly VITE_RELATIONSHIP_API_URL: string
  readonly VITE_PUBLIC_API_URL: string
  readonly VITE_PAYMENT_FRONT_URL: string
  readonly VITE_PAYMENT_API_URL: string
  readonly VITE_GROUP_FRONT_URL: string
  readonly VITE_GROUP_API_URL: string
  readonly VITE_CHAT_FRONT_URL: string
  readonly VITE_CHAT_API_URL: string
  readonly VITE_VAPID_PUBLIC_KEY: string
  readonly VITE_ACCOUNT_FRONT_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
