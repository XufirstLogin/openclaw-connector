import { shell } from 'electron';
import { TunnelAdapterFactory } from './tunnel/TunnelAdapterFactory';
import { buildLocalGuiUrl } from './tunnel/utils';
import { TunnelConnectRequest, TunnelConnectResult, TunnelStateSnapshot } from '../src/types/bridge';
import { TunnelAdapter } from './tunnel/adapters/TunnelAdapter';

export class TunnelManager {
  private state: TunnelStateSnapshot = {
    status: 'disconnected',
  };

  private readonly adapterFactory = new TunnelAdapterFactory();
  private activeAdapter: TunnelAdapter | null = null;
  private activeConfig: TunnelConnectRequest | null = null;

  getStatus(): TunnelStateSnapshot {
    const liveSnapshot = this.activeAdapter?.getSnapshot();
    if (liveSnapshot) {
      this.state = { ...this.state, ...liveSnapshot };
    }
    return { ...this.state };
  }

  async connect(config: TunnelConnectRequest): Promise<TunnelConnectResult> {
    if (this.state.status === 'connecting' || this.state.status === 'connected') {
      return {
        connected: false,
        reason: '???????????',
        localUrl: this.state.localUrl,
        commandPreview: this.state.commandPreview,
        mode: this.state.mode,
      };
    }

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
        reason: '?? serverIp / sshUsername / openclawToken ??????',
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
        localUrl: result.localUrl ?? buildLocalGuiUrl(config.openclawToken),
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

    this.activeAdapter = adapter;
    this.activeConfig = { ...config };

    const adapterSnapshot = adapter.getSnapshot();
    this.state = {
      status: 'connected',
      localUrl: result.localUrl ?? buildLocalGuiUrl(config.openclawToken),
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
  }

  async testConnection(config: TunnelConnectRequest): Promise<TunnelConnectResult> {
    if (this.state.status === 'connecting' || this.state.status === 'connected') {
      return {
        connected: false,
        reason: '??????????????????',
        mode: this.state.mode,
      };
    }

    if (!config.serverIp || !config.openclawToken || !config.sshUsername) {
      return {
        connected: false,
        reason: '?? serverIp / sshUsername / openclawToken ??????',
        mode: 'skeleton',
      };
    }

    const testFactory = new TunnelAdapterFactory();
    const adapter = testFactory.pick(config);
    const result = await adapter.connect(config);

    try {
      await adapter.disconnect();
    } catch {
      // best-effort cleanup
    }

    return result;
  }

  async isTunnelAlive(): Promise<boolean> {
    if (!this.activeAdapter || this.state.status !== 'connected') {
      return false;
    }

    const liveSnapshot = this.activeAdapter.getSnapshot();
    if (liveSnapshot.status === 'error' || liveSnapshot.status === 'disconnected') {
      return false;
    }

    return true;
  }

  async checkHealth(): Promise<TunnelStateSnapshot> {
    if (!this.activeAdapter) {
      return this.getStatus();
    }

    const liveSnapshot = this.activeAdapter.getSnapshot();
    this.state = { ...this.state, ...liveSnapshot };

    if (this.state.status !== 'connected') {
      if (this.state.status === 'error' || this.state.status === 'disconnected') {
        this.activeAdapter = null;
        this.activeConfig = null;
      }
      return { ...this.state };
    }

    const alive = await this.isTunnelAlive();
    if (!alive) {
      this.activeAdapter = null;
      this.activeConfig = null;
      this.state = {
        ...this.state,
        status: 'error',
        reason: liveSnapshot.reason ?? this.state.reason ?? 'SSH ????????????',
      };
    }

    return { ...this.state };
  }

  async disconnect() {
    this.state = {
      ...this.state,
      status: 'disconnecting',
    };

    if (this.activeAdapter) {
      await this.activeAdapter.disconnect();
    }

    this.activeAdapter = null;
    this.activeConfig = null;
    this.state = {
      status: 'disconnected',
    };
    return { disconnected: true };
  }

  async openGui(token: string) {
    const url = buildLocalGuiUrl(token);
    await shell.openExternal(url);
    return { opened: true, url };
  }

  getActiveConfig() {
    return this.activeConfig ? { ...this.activeConfig } : null;
  }
}
