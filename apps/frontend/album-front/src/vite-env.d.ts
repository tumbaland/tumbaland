/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALBUM_API_URL: string;
  readonly VITE_AUTH_SERVICE_URL: string;
  readonly VITE_AUTH_FRONT_URL: string;
  readonly VITE_ALBUM_FRONT_URL: string;
  readonly VITE_FILE_API_URL: string;
  readonly VITE_GROUP_API_URL: string;
  readonly VITE_ACCOUNT_FRONT_URL: string;
  readonly VITE_SHELL_FRONT_URL: string;
  readonly VITE_SEGMENTATION_API_URL: string;
  readonly VITE_OBJECT_DETECTION_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
