/// <reference types="vite/client" />

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
  readonly VITE_ACCOUNT_FRONT_URL: string
  readonly VITE_SEGMENTATION_API_URL: string
  readonly VITE_OBJECT_DETECTION_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
