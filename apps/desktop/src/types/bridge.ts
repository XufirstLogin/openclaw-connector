import type {
  LocalProfileDocument,
  LocalProfileExportPayload,
  LocalProfileImportPayload,
  LocalServerRecord,
  SaveLocalServerInput,
} from './localProfile';

export type TunnelStatus = 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';
export type AuthType = 'password' | 'key';
export type TunnelAdapterKind = 'mock' | 'ssh-command' | 'ssh2';
export type TunnelMode = 'ipc' | 'mock' | 'skeleton';
export type AppNavigationTarget = 'workspace' | 'settings' | 'diagnostics';

export interface TunnelConnectRequest {
  serverId?: string;
  serverName?: string;
  serverIp: string;
  sshPort: number;
  sshUsername: string;
  authType: AuthType;
  sshPassword?: string;
  sshPrivateKey?: string;
  openclawToken: string;
}

export interface TunnelConnectResult {
  connected: boolean;
  reason?: string;
  localUrl?: string;
  commandPreview?: string;
  mode?: TunnelMode;
}

export interface TunnelDisconnectResult {
  disconnected: boolean;
}

export interface TunnelAdapterDiagnostic {
  kind: TunnelAdapterKind;
  supported: boolean;
  priority: number;
  reason?: string;
}

export interface TunnelStateSnapshot {
  status: TunnelStatus;
  localUrl?: string;
  commandPreview?: string;
  serverId?: string;
  serverName?: string;
  serverIp?: string;
  sshUsername?: string;
  authType?: AuthType;
  reason?: string;
  adapterKind?: TunnelAdapterKind;
  mode?: TunnelMode;
  diagnostics?: TunnelAdapterDiagnostic[];
}

export interface DiagnosticsLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  message: string;
  serverId?: string;
  serverName?: string;
}

export interface TunnelPreflightResult {
  ok: boolean;
  issues: string[];
}

export interface ImportPreviewItem {
  name: string;
  serverIp: string;
  sshUsername: string;
}

export interface ImportPreviewResult {
  totalCount: number;
  newCount: number;
  duplicateCount: number;
  skippedCount: number;
  duplicates: ImportPreviewItem[];
}

export interface TunnelBridge {
  getStatus: () => Promise<TunnelStateSnapshot>;
  connect: (config: TunnelConnectRequest) => Promise<TunnelConnectResult>;
  testConnection: (config: TunnelConnectRequest) => Promise<TunnelConnectResult>;
  runPreflightChecks: (config: TunnelConnectRequest) => Promise<TunnelPreflightResult>;
  disconnect: () => Promise<TunnelDisconnectResult>;
  openGui: (token: string) => Promise<{ opened: boolean; url: string }>;
  onStatusChanged: (listener: (snapshot: TunnelStateSnapshot) => void) => (() => void);
}

export interface ImportFromDialogResult {
  canceled: boolean;
  profile?: LocalProfileDocument;
  importedCount?: number;
}

export interface ExportToDialogResult {
  canceled: boolean;
  filePath?: string;
  exportedCount?: number;
}

export interface LocalProfileBridge {
  load: () => Promise<LocalProfileDocument>;
  list: () => Promise<LocalServerRecord[]>;
  save: (server: SaveLocalServerInput) => Promise<LocalProfileDocument>;
  deleteServer: (id: string) => Promise<LocalProfileDocument>;
  setDefault: (id: string) => Promise<LocalProfileDocument>;
  markConnected: (id: string) => Promise<LocalProfileDocument>;
  importData: (payload: LocalProfileImportPayload) => Promise<LocalProfileDocument>;
  exportData: () => Promise<LocalProfileExportPayload>;
  previewImport: (backupPassword?: string) => Promise<ImportPreviewResult>;
  importFromDialog: (backupPassword?: string) => Promise<ImportFromDialogResult>;
  exportToDialog: (backupPassword: string) => Promise<ExportToDialogResult>;
}

export interface AppSettingsBridge {
  getAutostartEnabled: () => Promise<boolean>;
  setAutostartEnabled: (enabled: boolean) => Promise<{ enabled: boolean }>;
}

export interface DiagnosticsBridge {
  listDiagnostics: () => Promise<DiagnosticsLogEntry[]>;
  clearDiagnostics: () => Promise<{ cleared: boolean }>;
}

export interface AppMetadata {
  productName: string;
  version: string;
  platform: string;
  runtimeMode: string;
  storageDir: string;
  logDir: string;
  copyrightOwner: string;
  authorName: string;
  authorId: string;
  sourceNote: string;
}

export interface AppBridge {
  onNavigate: (listener: (target: AppNavigationTarget) => void) => (() => void);
  getMetadata: () => Promise<AppMetadata>;
}

export interface DesktopWindowState {
  isMaximized: boolean;
}

export interface WindowControlsBridge {
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  getState: () => Promise<DesktopWindowState>;
}

export interface OpenClawDesktopBridge {
  version: string;
  tunnel: TunnelBridge;
  profile: LocalProfileBridge;
  settings: AppSettingsBridge;
  diagnostics: DiagnosticsBridge;
  app: AppBridge;
  windowControls: WindowControlsBridge;
}

declare global {
  interface Window {
    openclawDesktop?: OpenClawDesktopBridge;
  }
}

export {};
