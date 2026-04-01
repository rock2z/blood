/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** HTTP(S) base URL of the backend, e.g. https://blood-64o1.onrender.com.
   *  Leave unset in dev — the Vite proxy handles /ws and /api. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
