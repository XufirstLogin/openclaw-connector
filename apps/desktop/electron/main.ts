import { app, BrowserWindow, dialog, ipcMain, Menu, Tray } from 'electron';
import path from 'node:path';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { LocalProfileCrypto } from '../src/lib/localProfileCrypto';
import { LocalProfileRepository } from '../src/lib/localProfileRepository';
import { LocalProfileService } from '../src/lib/localProfileService';
import type { LocalServerRecord } from '../src/types/localProfile';
import type {
  DiagnosticsLogEntry,
  TunnelConnectRequest,
  TunnelConnectResult,
  TunnelPreflightResult,
  TunnelStateSnapshot,
} from '../src/types/bridge';
import { registerLocalProfileHandlers } from './ipc/localProfileHandlers';
import { TunnelManager } from './tunnelManager';

const tunnelManager = new TunnelManager();
const APP_VERSION = '0.2.0';
const APP_PRODUCT_NAME = 'OpenClaw Connector';
const APP_RUNTIME_MODE = '本地模式';
const APP_COPYRIGHT_OWNER = 'CSDN 作者';
const APP_AUTHOR_NAME = '小小许下士';
const APP_AUTHOR_ID = 'weixin_46085234';
const APP_SOURCE_NOTE = '本软件部分设计与实现思路来源于 CSDN 作者“小小许下士（weixin_46085234）”。';
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const TUNNEL_HEALTH_POLL_MS = 5_000;
const RECONNECT_DELAY_MS = [3_000, 5_000, 10_000] as const;
const MAX_DIAGNOSTIC_ENTRIES = 200;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let tunnelHealthMonitor: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempt = 0;
let profileService: LocalProfileService | null = null;
let lastConnectedServerId: string | null = null;
let reconnectConfig: TunnelConnectRequest | null = null;
let userRequestedDisconnect = false;
const diagnosticsLog: DiagnosticsLogEntry[] = [];

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function resolveWindowIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'build', 'icon.png');
}

async function isLocalPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function runPreflightChecks(config: TunnelConnectRequest): Promise<TunnelPreflightResult> {
  const issues: string[] = [];

  if (!config.serverIp?.trim()) {
    issues.push('请填写服务器公网 IP。');
  }
  if (!config.sshUsername?.trim()) {
    issues.push('请填写 SSH 用户名。');
  }
  if (!config.openclawToken?.trim()) {
    issues.push('请填写 OpenClaw Token。');
  }
  if (config.openclawToken?.trim() && config.openclawToken.trim().length < 8) {
    issues.push('OpenClaw Token 长度过短，请检查后重新填写。');
  }
  if (!Number.isInteger(config.sshPort) || config.sshPort < 1 || config.sshPort > 65535) {
    issues.push('SSH 端口必须是 1-65535 之间的整数。');
  }

  const portAvailable = await isLocalPortAvailable(18789);
  if (!portAvailable) {
    issues.push('本地端口 18789 已被占用，请先关闭占用程序。');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

function appendDiagnosticsEntry(
  level: DiagnosticsLogEntry['level'],
  event: string,
  message: string,
  snapshot?: Partial<TunnelStateSnapshot>,
) {
  diagnosticsLog.unshift({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    serverId: snapshot?.serverId,
    serverName: snapshot?.serverName,
  });

  if (diagnosticsLog.length > MAX_DIAGNOSTIC_ENTRIES) {
    diagnosticsLog.length = MAX_DIAGNOSTIC_ENTRIES;
  }
}

function listDiagnostics() {
  return diagnosticsLog.map((entry) => ({ ...entry }));
}

function clearDiagnostics() {
  diagnosticsLog.length = 0;
  return { cleared: true };
}

function resolveAutostartEnabled() {
  if (process.platform !== 'win32') {
    return false;
  }

  return app.getLoginItemSettings().openAtLogin;
}

function applyAutostartEnabled(enabled: boolean) {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
    });
  }

  return {
    enabled: resolveAutostartEnabled(),
  };
}

function getAppMetadata() {
  const repository = new LocalProfileRepository({
    appDataDir: app.getPath('appData'),
    productName: APP_PRODUCT_NAME,
  });

  return {
    productName: APP_PRODUCT_NAME,
    version: APP_VERSION,
    platform: process.platform === 'win32' ? 'Windows' : process.platform,
    runtimeMode: APP_RUNTIME_MODE,
    storageDir: repository.storageDir,
    logDir: app.getPath('logs'),
    copyrightOwner: APP_COPYRIGHT_OWNER,
    authorName: APP_AUTHOR_NAME,
    authorId: APP_AUTHOR_ID,
    sourceNote: APP_SOURCE_NOTE,
  };
}

function showMainWindow() {
  if (!mainWindow) {
    return;
  }

  mainWindow.setSkipTaskbar(false);

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
  refreshTrayMenu();
}

function sendRendererNavigation(target: 'diagnostics' | 'settings') {
  showMainWindow();

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('openclaw:app:navigate', target);
    }
  }
}

function hideMainWindowToTray() {
  if (!mainWindow) {
    return;
  }

  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
  refreshTrayMenu();
}

function getKnownServers() {
  return profileService?.load().servers ?? [];
}

function findKnownServerById(serverId?: string | null) {
  if (!serverId) {
    return null;
  }

  return getKnownServers().find((server) => server.id === serverId) ?? null;
}

function findTrayCurrentServer() {
  const activeServer = findKnownServerById(tunnelManager.getStatus().serverId);
  if (activeServer) {
    return activeServer;
  }

  const lastConnectedServer = findKnownServerById(lastConnectedServerId);
  if (lastConnectedServer) {
    return lastConnectedServer;
  }

  const servers = getKnownServers();
  return servers.find((server) => server.isDefault)
    ?? servers
      .slice()
      .sort((left, right) => {
        const leftTime = left.lastConnectedAt ? new Date(left.lastConnectedAt).getTime() : 0;
        const rightTime = right.lastConnectedAt ? new Date(right.lastConnectedAt).getTime() : 0;
        return rightTime - leftTime;
      })[0]
    ?? null;
}

function findReconnectServer() {
  return findKnownServerById(lastConnectedServerId) ?? findTrayCurrentServer();
}

function toTunnelConnectRequest(server: LocalServerRecord): TunnelConnectRequest {
  return {
    serverId: server.id,
    serverName: server.name,
    serverIp: server.serverIp,
    sshPort: server.sshPort,
    sshUsername: server.sshUsername,
    authType: server.authType,
    sshPassword: server.sshPassword,
    sshPrivateKey: server.sshPrivateKey,
    openclawToken: server.openclawToken,
  };
}

function rememberSuccessfulConnection(serverId?: string | null) {
  if (!serverId) {
    return;
  }

  lastConnectedServerId = serverId;
  try {
    profileService?.markConnected(serverId);
  } catch {
    // keep tray workflow resilient even if profile persistence fails
  }
}

function stopReconnectSequence(resetAttempts = true) {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (resetAttempts) {
    reconnectAttempt = 0;
  }
}

async function scheduleReconnectAttempt(reason?: string) {
  if (userRequestedDisconnect || isQuitting || !reconnectConfig || reconnectTimer) {
    return;
  }

  if (reconnectAttempt >= RECONNECT_DELAY_MS.length) {
    appendDiagnosticsEntry('warn', 'reconnect_exhausted', '\u81ea\u52a8\u91cd\u8fde\u5df2\u7528\u5c3d\uff0c\u8bf7\u624b\u52a8\u91cd\u8bd5\u3002', reconnectConfig);
    return;
  }

  const nextAttempt = reconnectAttempt + 1;
  const delay = RECONNECT_DELAY_MS[reconnectAttempt];
  appendDiagnosticsEntry('warn', 'reconnect_scheduled', `\u8fde\u63a5\u5f02\u5e38\uff0c${delay}ms \u540e\u8fdb\u884c\u7b2c ${nextAttempt}/3 \u6b21\u81ea\u52a8\u91cd\u8fde\u3002${reason ? ` ${reason}` : ''}`, reconnectConfig);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempt = nextAttempt;

    // If the user explicitly disconnected while this timer was pending, abort.
    if (userRequestedDisconnect || isQuitting) return;

    // Capture config at scheduling time so a concurrent manual connect
    // cannot replace it with a different server's config mid-flight.
    const configSnapshot = reconnectConfig ? { ...reconnectConfig } : null;
    if (!configSnapshot) return;

    appendDiagnosticsEntry('info', 'reconnect_attempt', `\u6b63\u5728\u6267\u884c\u7b2c ${nextAttempt}/3 \u6b21\u81ea\u52a8\u91cd\u8fde\u3002`, configSnapshot);

    void tunnelManager.connect(configSnapshot)
      .then((result) => {
        // Re-check: user may have disconnected while connect() was in-flight.
        if (userRequestedDisconnect) {
          void tunnelManager.disconnect().catch(() => undefined);
          emitTunnelStatusChanged();
          return;
        }

        if (result.connected) {
          rememberSuccessfulConnection(configSnapshot.serverId ?? null);
          appendDiagnosticsEntry('info', 'reconnect_success', '\u81ea\u52a8\u91cd\u8fde\u6210\u529f\u3002', configSnapshot);
          stopReconnectSequence();
          emitTunnelStatusChanged();
          return;
        }

        appendDiagnosticsEntry('error', 'reconnect_failed', result.reason ?? '\u81ea\u52a8\u91cd\u8fde\u5931\u8d25\u3002', configSnapshot);
        emitTunnelStatusChanged();
        void scheduleReconnectAttempt(result.reason);
      })
      .catch((error) => {
        appendDiagnosticsEntry('error', 'reconnect_failed', error instanceof Error ? error.message : '\u81ea\u52a8\u91cd\u8fde\u5931\u8d25\u3002', configSnapshot);
        emitTunnelStatusChanged();
        void scheduleReconnectAttempt(error instanceof Error ? error.message : undefined);
      });
  }, delay);
}

async function connectServerFromTray(server: LocalServerRecord | null): Promise<TunnelConnectResult> {
  if (!server) {
    return {
      connected: false,
      reason: '\u672a\u627e\u5230\u53ef\u7528\u7684\u670d\u52a1\u5668\u914d\u7f6e\u3002',
    };
  }

  const request = toTunnelConnectRequest(server);
  reconnectConfig = { ...request };
  userRequestedDisconnect = false;
  stopReconnectSequence();
  appendDiagnosticsEntry('info', 'connect_requested', '\u6258\u76d8\u53d1\u8d77\u8fde\u63a5\u3002', request);

  const result = await tunnelManager.connect(request);
  if (result.connected) {
    rememberSuccessfulConnection(server.id);
    appendDiagnosticsEntry('info', 'connect_succeeded', '\u8fde\u63a5\u6210\u529f\u3002', request);
  } else {
    appendDiagnosticsEntry('error', 'connect_failed', result.reason ?? '\u8fde\u63a5\u5931\u8d25\u3002', request);
  }
  emitTunnelStatusChanged();
  return result;
}

async function reconnectLastServer() {
  return connectServerFromTray(findReconnectServer());
}

async function openActiveOpenClaw() {
  const activeConfig = tunnelManager.getActiveConfig();
  if (!activeConfig?.openclawToken) {
    return { opened: false, url: '' };
  }

  return tunnelManager.openGui(activeConfig.openclawToken);
}

function getTrayTargetLabel(snapshot: TunnelStateSnapshot) {
  const serverName = snapshot.serverName?.trim();
  if (serverName) {
    return ` ${serverName}`;
  }

  if (snapshot.sshUsername && snapshot.serverIp) {
    return ` ${snapshot.sshUsername}@${snapshot.serverIp}`;
  }

  return '';
}

function getTrayStatusLabel(snapshot: TunnelStateSnapshot) {
  const prefix = '\u5f53\u524d\u72b6\u6001\uff1a';
  const target = getTrayTargetLabel(snapshot);

  if (snapshot.status === 'connected') {
    return `${prefix}\u5df2\u8fde\u63a5${target}`;
  }

  if (snapshot.status === 'connecting') {
    return `${prefix}\u8fde\u63a5\u4e2d${target}`;
  }

  if (snapshot.status === 'disconnecting') {
    return `${prefix}\u65ad\u5f00\u4e2d${target}`;
  }

  if (snapshot.status === 'error') {
    return `${prefix}\u5f02\u5e38${target}`;
  }

  return `${prefix}\u672a\u8fde\u63a5`;
}

function stopTunnelHealthMonitor() {
  if (tunnelHealthMonitor) {
    clearTimeout(tunnelHealthMonitor);
    tunnelHealthMonitor = null;
  }
}

function startTunnelHealthMonitor() {
  stopTunnelHealthMonitor();

  if (tunnelManager.getStatus().status !== 'connected') {
    return;
  }

  function scheduleNextCheck() {
    tunnelHealthMonitor = setTimeout(() => {
      tunnelHealthMonitor = null;
      void tunnelManager.checkHealth()
        .then((snapshot) => {
          if (snapshot.status !== 'connected') {
            appendDiagnosticsEntry('warn', 'health_check_failed', snapshot.reason ?? '\u8fde\u63a5\u5065\u5eb7\u68c0\u67e5\u5931\u8d25\u3002', snapshot);
            emitTunnelStatusChanged();
          }
        })
        .catch((error) => {
          appendDiagnosticsEntry('error', 'health_check_failed', error instanceof Error ? error.message : '\u8fde\u63a5\u5065\u5eb7\u68c0\u67e5\u5931\u8d25\u3002');
        })
        .finally(() => {
          // Only schedule next check if monitor hasn't been stopped
          if (tunnelManager.getStatus().status === 'connected') {
            scheduleNextCheck();
          }
        });
    }, TUNNEL_HEALTH_POLL_MS);
  }

  scheduleNextCheck();
}

function refreshTrayMenu(snapshot: TunnelStateSnapshot = tunnelManager.getStatus()) {
  if (!tray) {
    return;
  }

  const canDisconnect = snapshot.status !== 'disconnected';
  const canConnectCurrent = snapshot.status === 'disconnected' && Boolean(findTrayCurrentServer());
  const canReconnect = snapshot.status === 'disconnected' && Boolean(findReconnectServer());
  const canOpenGui = snapshot.status === 'connected' && Boolean(tunnelManager.getActiveConfig()?.openclawToken);
  const statusLabel = getTrayStatusLabel(snapshot);

  tray.setToolTip(`OpenClaw Connector - ${statusLabel}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: statusLabel,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '\u663e\u793a\u4e3b\u7a97\u53e3',
      click: () => showMainWindow(),
    },
    {
      label: '\u6253\u5f00\u8bca\u65ad',
      click: () => sendRendererNavigation('diagnostics'),
    },
    {
      label: '\u6253\u5f00\u8bbe\u7f6e',
      click: () => sendRendererNavigation('settings'),
    },
    { type: 'separator' },
    {
      // connect current server
      label: '\u8fde\u63a5\u5f53\u524d\u670d\u52a1\u5668',
      enabled: canConnectCurrent,
      click: () => {
        void connectServerFromTray(findTrayCurrentServer()).catch(() => undefined);
      },
    },
    {
      // reconnect
      label: '\u91cd\u65b0\u8fde\u63a5',
      enabled: canReconnect,
      click: () => {
        void reconnectLastServer().catch(() => undefined);
      },
    },
    {
      // open OpenClaw
      label: '\u6253\u5f00 OpenClaw',
      enabled: canOpenGui,
      click: () => {
        void openActiveOpenClaw().catch(() => undefined);
      },
    },
    {
      label: '\u65ad\u5f00\u8fde\u63a5',
      enabled: canDisconnect,
      click: () => {
        userRequestedDisconnect = true;
        stopReconnectSequence();
        appendDiagnosticsEntry('info', 'disconnect_requested', '\u6258\u76d8\u53d1\u8d77\u65ad\u5f00\u3002', tunnelManager.getStatus());
        void tunnelManager.disconnect()
          .then(() => {
            appendDiagnosticsEntry('info', 'disconnect_succeeded', '\u8fde\u63a5\u5df2\u65ad\u5f00\u3002');
            emitTunnelStatusChanged();
          })
          .catch((error) => {
            appendDiagnosticsEntry('error', 'disconnect_failed', error instanceof Error ? error.message : '\u65ad\u5f00\u5931\u8d25\u3002');
            emitTunnelStatusChanged();
          });
      },
    },
    { type: 'separator' },
    {
      label: '\u9000\u51fa\u8f6f\u4ef6',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]));
}

function emitTunnelStatusChanged() {
  const snapshot = tunnelManager.getStatus();

  if (snapshot.status === 'connected') {
    stopReconnectSequence();
    startTunnelHealthMonitor();
  } else {
    stopTunnelHealthMonitor();
  }

  if (snapshot.status === 'error' && !userRequestedDisconnect) {
    void scheduleReconnectAttempt(snapshot.reason);
  }

  refreshTrayMenu(snapshot);

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('openclaw:tunnel:status-changed', snapshot);
    }
  }

  return snapshot;
}

function createTray() {
  if (tray) {
    refreshTrayMenu();
    return tray;
  }

  tray = new Tray(resolveWindowIconPath());
  refreshTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.focus();
      return;
    }

    showMainWindow();
  });

  tray.on('double-click', () => {
    showMainWindow();
  });

  return tray;
}

function registerIpcHandlers() {
  const profileRepository = new LocalProfileRepository({
    appDataDir: app.getPath('appData'),
  });
  const profileCrypto = new LocalProfileCrypto(profileRepository.keyFilePath);
  profileService = new LocalProfileService(profileRepository, profileCrypto);

  ipcMain.handle('openclaw:get-version', () => APP_VERSION);
  ipcMain.handle('openclaw:tunnel:get-status', () => tunnelManager.getStatus());
  ipcMain.handle('openclaw:tunnel:connect', async (_event, config: TunnelConnectRequest): Promise<TunnelConnectResult> => {
    reconnectConfig = { ...config };
    userRequestedDisconnect = false;
    stopReconnectSequence();
    appendDiagnosticsEntry('info', 'connect_requested', '\u7528\u6237\u53d1\u8d77\u8fde\u63a5\u3002', config);

    const result = await tunnelManager.connect(config);
    if (result.connected) {
      rememberSuccessfulConnection(config.serverId ?? null);
      appendDiagnosticsEntry('info', 'connect_succeeded', '\u8fde\u63a5\u6210\u529f\u3002', config);
    } else {
      appendDiagnosticsEntry('error', 'connect_failed', result.reason ?? '\u8fde\u63a5\u5931\u8d25\u3002', config);
    }
    emitTunnelStatusChanged();
    return result;
  });
  ipcMain.handle('openclaw:tunnel:test', (_event, config: TunnelConnectRequest) => tunnelManager.testConnection(config));
  ipcMain.handle('openclaw:tunnel:preflight', async (_event, config: TunnelConnectRequest): Promise<TunnelPreflightResult> => runPreflightChecks(config));
  ipcMain.handle('openclaw:tunnel:disconnect', async () => {
    userRequestedDisconnect = true;
    stopReconnectSequence();
    appendDiagnosticsEntry('info', 'disconnect_requested', '\u7528\u6237\u53d1\u8d77\u65ad\u5f00\u3002', tunnelManager.getStatus());

    const result = await tunnelManager.disconnect();
    appendDiagnosticsEntry('info', 'disconnect_succeeded', '\u8fde\u63a5\u5df2\u65ad\u5f00\u3002');
    emitTunnelStatusChanged();
    return result;
  });
  ipcMain.handle('openclaw:tunnel:open-gui', (_event, token: string) => tunnelManager.openGui(token));
  ipcMain.handle('openclaw:settings:autostart:get', () => resolveAutostartEnabled());
  ipcMain.handle('openclaw:settings:autostart:set', (_event, enabled: boolean) => applyAutostartEnabled(Boolean(enabled)));
  ipcMain.handle('openclaw:diagnostics:list', () => listDiagnostics());
  ipcMain.handle('openclaw:diagnostics:clear', () => clearDiagnostics());
  ipcMain.handle('openclaw:app:get-metadata', () => getAppMetadata());
  ipcMain.handle('openclaw:window:minimize', () => {
    mainWindow?.setSkipTaskbar(false);
    mainWindow?.minimize();
  });
  ipcMain.handle('openclaw:window:close', () => {
    hideMainWindowToTray();
  });
  ipcMain.handle('openclaw:window:get-state', () => ({ isMaximized: false }));
  registerLocalProfileHandlers(ipcMain, profileService, profileCrypto, dialog, () => mainWindow ?? BrowserWindow.getFocusedWindow());
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1440,
    minHeight: 960,
    resizable: false,
    minimizable: true,
    maximizable: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#eaf2ff',
    icon: resolveWindowIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow = win;
  createTray();

  win.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    hideMainWindowToTray();
  });

  win.on('minimize', () => {
    win.setSkipTaskbar(false);
    refreshTrayMenu();
  });

  win.on('restore', () => {
    win.setSkipTaskbar(false);
    refreshTrayMenu();
  });

  win.on('show', () => {
    win.setSkipTaskbar(false);
    refreshTrayMenu();
  });

  win.on('hide', () => {
    refreshTrayMenu();
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  if (devServerUrl) {
    await win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }
}

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    void createWindow();

    app.on('activate', () => {
      if (mainWindow) {
        showMainWindow();
        return;
      }

      void createWindow();
    });
  });
}

app.on('before-quit', (event) => {
  isQuitting = true;
  stopTunnelHealthMonitor();
  stopReconnectSequence();

  // Ensure active SSH tunnel is terminated before the process exits.
  // Without this, spawned ssh.exe child processes become orphans.
  if (tunnelManager.getStatus().status !== 'disconnected') {
    event.preventDefault();
    tunnelManager.disconnect()
      .catch(() => undefined)
      .finally(() => {
        app.exit();
      });
  }
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') {
    return;
  }
});
