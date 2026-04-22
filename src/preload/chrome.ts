import { contextBridge } from 'electron';
import { cloverApi, type CloverApi } from './api';

contextBridge.exposeInMainWorld('clover', cloverApi);

export type { CloverApi };
