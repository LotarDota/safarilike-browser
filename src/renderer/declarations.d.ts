import type { SafariLikeApi } from '../preload/chrome';

declare global {
  interface Window {
    safarilike: SafariLikeApi;
    safarilikeTab?: { version: number };
  }
}

export {};
