/// <reference types="vite/client" />

/** Version from package.json (or APP_VERSION_OVERRIDE), set at build time by vite.config.ts. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Test builds only: where to read the latest version from (a data: URL works without any network). */
  readonly VITE_VERSION_URL?: string;
  /** "1" in a Play Store build: the store updates the app, so no check and no switch. */
  readonly VITE_DISABLE_UPDATE_CHECK?: string;
}
