import { TunnelConnectRequest, TunnelConnectResult, TunnelStateSnapshot } from '../../../src/types/bridge';
import { TunnelAdapter, TunnelAdapterAssessment } from './TunnelAdapter';
import { buildLocalGuiUrl, buildSshCommandPreview } from '../utils';

export class MockTunnelAdapter implements TunnelAdapter {
  readonly kind = 'mock' as const;
  private snapshot: Partial<TunnelStateSnapshot> = {};

  assess(_config: TunnelConnectRequest): TunnelAdapterAssessment {
    return {
      supported: true,
      priority: 1,
      reason: 'Fallback mock adapter for scaffold mode.',
    };
  }

  async connect(config: TunnelConnectRequest): Promise<TunnelConnectResult> {
    const commandPreview = buildSshCommandPreview(config);
    this.snapshot = {
      status: 'connected',
      adapterKind: this.kind,
      mode: 'mock',
      localUrl: buildLocalGuiUrl(config.openclawToken, config.openclawPort),
      commandPreview,
      reason: 'Using mock adapter because a real tunnel backend is not active in this scaffold.',
    };

    return {
      connected: true,
      mode: 'mock',
      localUrl: this.snapshot.localUrl,
      commandPreview,
      reason: this.snapshot.reason,
    };
  }

  async disconnect(): Promise<void> {
    this.snapshot = {
      status: 'disconnected',
      adapterKind: this.kind,
      mode: 'mock',
    };
  }

  getSnapshot(): Partial<TunnelStateSnapshot> {
    return { ...this.snapshot, adapterKind: this.kind, mode: 'mock' };
  }
}



