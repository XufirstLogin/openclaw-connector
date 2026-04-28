import http from 'node:http';
import { shell } from 'electron';
import { TunnelAdapterFactory } from './tunnel/TunnelAdapterFactory';
import { buildLocalGuiUrl } from './tunnel/utils';
import { TunnelConnectRequest, TunnelConnectResult, TunnelStateSnapshot } from '../src/types/bridge';
import { TunnelAdapter } from './tunnel/adapters/TunnelAdapter';

async function verifyOpenClawEndpoint(openclawPort: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port: openclawPort,
        path: '/',
        timeout: 3_000,
      },
      (response) => {
        response.resume();
        resolve();
      },
    );

    request.once('timeout', () => {
      request.destroy(new Error(`OpenClaw 端口 ${openclawPort} 未在预期时间内响应。`));
    });

    request.once('error', (error) => {
      reject(error);
    });
  });
}

export class TunnelManager {
  private state: TunnelStateSnapshot = {
    status: 'disconnected',
  };

  private readonly adapterFactory = new TunnelAdapterFactory();
  private activeAdapter: TunnelAdapter | null = null;
  private activeConfig: TunnelConnectRequest | null = null;
  private connectLock = false;

  getStatus(): TunnelStateSnapshot {
    const liveSnapshot = this.activeAdapter?.getSnapshot();
    if (liveSnapshot) {
      this.state = { ...this.state, ...liveSnapshot };
    }
    return { ...this.state };
  }

  async connect(config: TunnelConnectRequest): Promise<TunnelConnectResult> {
    if (this.connectLock) {
      return {
        connected: false,
        reason: 'A connection request is already being processed. Please wait.',
        localUrl: this.state.localUrl,
        commandPreview: this.state.commandPreview,
        mode: this.state.mode,
      };
    }

    if (this.state.status === 'connecting' || this.state.status === 'connected') {
      return {
        connected: false,
        reason: 'Another tunnel connection is already active.',
        localUrl: this.state.localUrl,
        commandPreview: this.state.commandPreview,
        mode: this.state.mode,
      };
    }

    this.connectLock = true;
    try {
      this.state = {
        status: 'connecting',
        serverId: config.serverId,
        serverName: config.serverName,
        serverIp: config.serverIp,
        sshUsername: config.sshUsername,
        authType: config.authType,
        diagnostics: this.adapterFactory.diagnose(config),
      };

      if (!config.serverIp || !config.openclawToken || !config.sshUsername) {
        this.activeAdapter = null;
        this.activeConfig = null;
        this.state = {
          status: 'error',
          reason: 'Missing required fields: serverIp / sshUsername / openclawToken.',
          diagnostics: this.adapterFactory.diagnose(config),
        };
        return {
          connected: false,
          reason: this.state.reason,
          mode: 'skeleton',
        };
      }

      const adapter = this.adapterFactory.pick(config);
      const result = await adapter.connect(config);

      if (!result.connected) {
        this.activeAdapter = null;
        this.activeConfig = null;
        this.state = {
          status: 'error',
          localUrl: result.localUrl ?? buildLocalGuiUrl(config.openclawToken, config.openclawPort),
          commandPreview: result.commandPreview,
          serverId: config.serverId,
          serverName: config.serverName,
          serverIp: config.serverIp,
          sshUsername: config.sshUsername,
          authType: config.authType,
          reason: result.reason,
          adapterKind: adapter.kind,
          mode: result.mode ?? adapter.getSnapshot().mode,
          diagnostics: this.adapterFactory.diagnose(config),
        };
        return {
          ...result,
          localUrl: this.state.localUrl,
          commandPreview: this.state.commandPreview,
          mode: this.state.mode,
        };
      }

      try {
        await verifyOpenClawEndpoint(config.openclawPort);
      } catch (error) {
        await adapter.disconnect();
        this.activeAdapter = null;
        this.activeConfig = null;
        const reason = error instanceof Error
          ? `OpenClaw 端口 ${config.openclawPort} 无法通过隧道访问：${error.message}`
          : `OpenClaw 端口 ${config.openclawPort} 无法通过隧道访问。`;
        this.state = {
          status: 'error',
          localUrl: result.localUrl ?? buildLocalGuiUrl(config.openclawToken, config.openclawPort),
          commandPreview: result.commandPreview,
          serverId: config.serverId,
          serverName: config.serverName,
          serverIp: config.serverIp,
          sshUsername: config.sshUsername,
          authType: config.authType,
          reason,
          adapterKind: adapter.kind,
          mode: result.mode ?? adapter.getSnapshot().mode,
          diagnostics: this.adapterFactory.diagnose(config),
        };
        return {
          connected: false,
          localUrl: this.state.localUrl,
          commandPreview: this.state.commandPreview,
          mode: this.state.mode,
          reason,
        };
      }

      this.activeAdapter = adapter;
      this.activeConfig = { ...config };

      const adapterSnapshot = adapter.getSnapshot();
      this.state = {
        status: 'connected',
        localUrl: result.localUrl ?? buildLocalGuiUrl(config.openclawToken, config.openclawPort),
        commandPreview: result.commandPreview,
        serverId: config.serverId,
        serverName: config.serverName,
        serverIp: config.serverIp,
        sshUsername: config.sshUsername,
        authType: config.authType,
        reason: result.reason,
        adapterKind: adapter.kind,
        mode: result.mode ?? adapterSnapshot.mode,
        diagnostics: this.adapterFactory.diagnose(config),
      };

      return {
        ...result,
        localUrl: this.state.localUrl,
        commandPreview: this.state.commandPreview,
        mode: this.state.mode,
      };
    } finally {
      this.connectLock = false;
    }
  }

  async testConnection(config: TunnelConnectRequest): Promise<TunnelConnectResult> {
    if (this.connectLock || this.state.status === 'connecting' || this.state.status === 'connected') {
      return {
        connected: false,
        reason: 'Another tunnel connection is already active, so test mode is unavailable.',
        mode: this.state.mode,
      };
    }

    if (!config.serverIp || !config.openclawToken || !config.sshUsername) {
      return {
        connected: false,
        reason: 'Missing required fields: serverIp / sshUsername / openclawToken.',
        mode: 'skeleton',
      };
    }

    this.connectLock = true;
    try {
      const testFactory = new TunnelAdapterFactory();
      const adapter = testFactory.pick(config);
      const result = await adapter.connect(config);

      if (result.connected) {
        try {
          await verifyOpenClawEndpoint(config.openclawPort);
        } catch (error) {
          return {
            connected: false,
            mode: result.mode,
            localUrl: result.localUrl,
            commandPreview: result.commandPreview,
            reason: error instanceof Error
              ? `OpenClaw 端口 ${config.openclawPort} 无法通过隧道访问：${error.message}`
              : `OpenClaw 端口 ${config.openclawPort} 无法通过隧道访问。`,
          };
        }
      }

      try {
        await adapter.disconnect();
      } catch {
        // best-effort cleanup
      }

      return result;
    } finally {
      this.connectLock = false;
    }
  }

  async checkHealth(): Promise<TunnelStateSnapshot> {
    if (!this.activeAdapter) {
      return this.getStatus();
    }

    const liveSnapshot = this.activeAdapter.getSnapshot();
    this.state = { ...this.state, ...liveSnapshot };

    if (this.state.status === 'error' || this.state.status === 'disconnected') {
      this.activeAdapter = null;
      this.activeConfig = null;
      this.state = {
        ...this.state,
        status: 'error',
        reason: liveSnapshot.reason ?? this.state.reason ?? 'SSH connection dropped. Please reconnect.',
      };
      return { ...this.state };
    }

    return { ...this.state };
  }

  async disconnect() {
    this.state = {
      ...this.state,
      status: 'disconnecting',
    };

    try {
      if (this.activeAdapter) {
        await this.activeAdapter.disconnect();
      }
    } finally {
      this.activeAdapter = null;
      this.activeConfig = null;
      this.state = {
        status: 'disconnected',
      };
    }
    return { disconnected: true };
  }

  async openGui(token: string, openclawPort: number) {
    await verifyOpenClawEndpoint(openclawPort);
    const url = buildLocalGuiUrl(token, openclawPort);
    await shell.openExternal(url);
    return { opened: true, url };
  }

  getActiveConfig() {
    return this.activeConfig ? { ...this.activeConfig } : null;
  }
}


