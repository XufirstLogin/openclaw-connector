import type { ServerConfigState } from '../state/configStore';
import { DEFAULT_OPENCLAW_PORT } from '../state/configStore';
import type {
  TunnelConnectRequest,
  TunnelConnectResult,
  TunnelPreflightResult,
  TunnelStateSnapshot,
  TunnelStatus,
} from '../types/bridge';

let currentStatus: TunnelStatus = 'disconnected';
let activeConfig: ServerConfigState | null = null;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBridge() {
  return window.openclawDesktop?.tunnel;
}

export function buildLocalGuiUrl(token: string, openclawPort: number = DEFAULT_OPENCLAW_PORT) {
  return `http://127.0.0.1:${openclawPort}/#token=${encodeURIComponent(token)}`;
}

function toConnectRequest(config: ServerConfigState & { id?: string; name?: string }): TunnelConnectRequest {
  return {
    serverId: config.id,
    serverName: config.name,
    serverIp: config.serverIp,
    sshPort: config.sshPort,
    sshUsername: config.sshUsername,
    openclawPort: config.openclawPort,
    authType: config.authType,
    sshPassword: config.sshPassword,
    sshPrivateKey: config.sshPrivateKey,
    openclawToken: config.openclawToken,
  };
}

export async function getTunnelStatus(): Promise<TunnelStateSnapshot> {
  const bridge = getBridge();
  if (bridge) {
    return bridge.getStatus();
  }

  return {
    status: currentStatus,
    localUrl: activeConfig ? buildLocalGuiUrl(activeConfig.openclawToken, activeConfig.openclawPort) : undefined,
    serverId: (activeConfig as (ServerConfigState & { id?: string; name?: string }) | null)?.id,
    serverName: (activeConfig as (ServerConfigState & { id?: string; name?: string }) | null)?.name,
    serverIp: activeConfig?.serverIp,
    sshUsername: activeConfig?.sshUsername,
    authType: activeConfig?.authType,
  };
}

export async function runTunnelPreflightChecks(
  config: ServerConfigState & { id?: string; name?: string },
): Promise<TunnelPreflightResult> {
  const bridge = getBridge();
  if (bridge?.runPreflightChecks) {
    return bridge.runPreflightChecks(toConnectRequest(config));
  }

  const issues: string[] = [];
  if (!config.serverIp) {
    issues.push('请先填写服务器公网 IP。');
  }
  if (!config.sshUsername) {
    issues.push('请先填写 SSH 用户名。');
  }
  if (!config.openclawToken) {
    issues.push('请先填写 OpenClaw Token。');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export async function connectTunnel(config: ServerConfigState & { id?: string; name?: string }): Promise<TunnelConnectResult> {
  const bridge = getBridge();
  if (bridge) {
    return bridge.connect(toConnectRequest(config));
  }

  currentStatus = 'connecting';
  await wait(800);

  if (!config.serverIp || !config.openclawToken || !config.sshUsername) {
    currentStatus = 'error';
    return { connected: false, reason: '缺少服务器 IP、SSH 用户名或 OpenClaw Token。', mode: 'mock' };
  }

  activeConfig = { ...config };
  currentStatus = 'connected';
  return { connected: true, localUrl: buildLocalGuiUrl(config.openclawToken, config.openclawPort), mode: 'mock' };
}

export async function testTunnelConnection(config: ServerConfigState & { id?: string; name?: string }): Promise<TunnelConnectResult> {
  const bridge = getBridge();
  if (bridge?.testConnection) {
    return bridge.testConnection(toConnectRequest(config));
  }

  await wait(350);
  if (!config.serverIp || !config.openclawToken || !config.sshUsername) {
    return { connected: false, reason: '缺少服务器 IP、SSH 用户名或 OpenClaw Token。', mode: 'mock' };
  }

  return {
    connected: true,
    localUrl: buildLocalGuiUrl(config.openclawToken, config.openclawPort),
    mode: 'mock',
    reason: '测试连接成功。',
  };
}

export async function disconnectTunnel() {
  const bridge = getBridge();
  if (bridge) {
    return bridge.disconnect();
  }

  currentStatus = 'disconnecting';
  await wait(450);
  activeConfig = null;
  currentStatus = 'disconnected';
  return { disconnected: true };
}

export async function openGui(token: string, openclawPort: number = DEFAULT_OPENCLAW_PORT) {
  const bridge = getBridge();
  if (bridge) {
    return bridge.openGui(token, openclawPort);
  }

  const url = buildLocalGuiUrl(token, openclawPort);
  window.open(url, '_blank');
  return { opened: true, url };
}

export function subscribeTunnelStatus(listener: (snapshot: TunnelStateSnapshot) => void) {
  const bridge = getBridge();
  if (bridge?.onStatusChanged) {
    return bridge.onStatusChanged(listener);
  }

  return () => undefined;
}

