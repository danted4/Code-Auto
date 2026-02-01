/**
 * Environment variable types for process.env.
 * Augments NodeJS.ProcessEnv so TypeScript knows about NEXT_PUBLIC_* vars.
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_APP_VERSION?: string;
    }
  }
}

export {};
