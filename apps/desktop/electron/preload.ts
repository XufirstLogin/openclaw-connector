import { contextBridge, ipcRenderer } from 'electron';
import type { LocalProfileImportPayload, SaveLocalServerInput } from '../src/types/localProfile';
import {
  type AppNavigationTarget,
  type OpenClawDesktopBridge,
  type TunnelConnectRequest,
} from '../src/types/bridge';

const bridge: OpenClawDesktopBridge = {
  version: '0.2.1',
  tunnel: {
    getStatus: () => ipcRenderer.invoke('openclaw:tunnel:get-status'),
    connect: (config: TunnelConnectRequest) => ipcRenderer.invoke('openclaw:tunnel:connect', config),
    testConnection: (config: TunnelConnectRequest) => ipcRenderer.invoke('openclaw:tunnel:test', config),
    runPreflightChecks: (config: TunnelConnectRequest) => ipcRenderer.invoke('openclaw:tunnel:preflight', config),
    disconnect: () => ipcRenderer.invoke('openclaw:tunnel:disconnect'),
    openGui: (token: string, openclawPort: number) => ipcRenderer.invoke('openclaw:tunnel:open-gui', token, openclawPort),
    onStatusChanged: (listener) => {
      const channel = 'openclaw:tunnel:status-changed';
      const wrapped = (_event: Electron.IpcRendererEvent, snapshot: Parameters<typeof listener>[0]) => {
        listener(snapshot);
      };
      ipcRenderer.on(channel, wrapped);
      return () => {
        ipcRenderer.off(channel, wrapped);
      };
    },
  },
  profile: {
    load: () => ipcRenderer.invoke('openclaw:profile:load'),
    list: () => ipcRenderer.invoke('openclaw:profile:list'),
    save: (server: SaveLocalServerInput) => ipcRenderer.invoke('openclaw:profile:save', server),
    deleteServer: (id: string) => ipcRenderer.invoke('openclaw:profile:delete', id),
    setDefault: (id: string) => ipcRenderer.invoke('openclaw:profile:set-default', id),
    markConnected: (id: string) => ipcRenderer.invoke('openclaw:profile:mark-connected', id),
    importData: (payload: LocalProfileImportPayload) => ipcRenderer.invoke('openclaw:profile:import', payload),
    exportData: () => ipcRenderer.invoke('openclaw:profile:export'),
    previewImport: (backupPassword?: string) => ipcRenderer.invoke('openclaw:profile:preview-import', backupPassword ?? ''),
    importFromDialog: (backupPassword?: string) => ipcRenderer.invoke('openclaw:profile:import-dialog', backupPassword ?? ''),
    exportToDialog: (backupPassword: string) => ipcRenderer.invoke('openclaw:profile:export-dialog', backupPassword),
  },
  settings: {
    getAutostartEnabled: () => ipcRenderer.invoke('openclaw:settings:autostart:get'),
    setAutostartEnabled: (enabled: boolean) => ipcRenderer.invoke('openclaw:settings:autostart:set', enabled),
  },
  diagnostics: {
    listDiagnostics: () => ipcRenderer.invoke('openclaw:diagnostics:list'),
    clearDiagnostics: () => ipcRenderer.invoke('openclaw:diagnostics:clear'),
  },
  app: {
    onNavigate: (listener) => {
      const channel = 'openclaw:app:navigate';
      const wrapped = (_event: Electron.IpcRendererEvent, target: AppNavigationTarget) => {
        listener(target);
      };
      ipcRenderer.on(channel, wrapped);
      return () => {
        ipcRenderer.off(channel, wrapped);
      };
    },
    getMetadata: () => ipcRenderer.invoke('openclaw:app:get-metadata'),
  },
  windowControls: {
    minimize: () => ipcRenderer.invoke('openclaw:window:minimize'),
    close: () => ipcRenderer.invoke('openclaw:window:close'),
    getState: () => ipcRenderer.invoke('openclaw:window:get-state'),
  },
};

contextBridge.exposeInMainWorld('openclawDesktop', bridge);


