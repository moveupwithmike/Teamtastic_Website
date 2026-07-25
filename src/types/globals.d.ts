// Ambient declarations for browser globals and untyped packages used across
// the app. This file has no runtime output — it only informs `tsc --noEmit`
// (npm run typecheck).

export {};

declare global {
  interface Window {
    fbq?: {
      (...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      push?: unknown;
      loaded?: boolean;
      version?: string;
      queue?: unknown[];
    };
    _fbq?: unknown;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    turnstile?: {
      render: (container: Element, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
declare module "server-only" {}
