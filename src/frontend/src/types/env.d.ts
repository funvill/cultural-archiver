/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_BUILD_DATE?: string;
  [key: string]: string | boolean | undefined;
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv;
}
