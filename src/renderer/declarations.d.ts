import type { CloverApi } from '../preload/chrome';

declare global {
  interface Window {
    clover: CloverApi;
    cloverTab?: { version: number };
  }
}

export {};
