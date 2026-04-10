import { TunnelConnectRequest } from '../../src/types/bridge';
import { CommandSshTunnelAdapter } from './adapters/CommandSshTunnelAdapter';
import { MockTunnelAdapter } from './adapters/MockTunnelAdapter';
import { Ssh2TunnelAdapter } from './adapters/Ssh2TunnelAdapter';
import { TunnelAdapter } from './adapters/TunnelAdapter';

export class TunnelAdapterFactory {
  private createAdapters(): TunnelAdapter[] {
    return [
      new Ssh2TunnelAdapter(),
      new CommandSshTunnelAdapter(),
      new MockTunnelAdapter(),
    ];
  }

  pick(config: TunnelConnectRequest): TunnelAdapter {
    const adapters = this.createAdapters();
    const ranked = adapters
      .map((adapter) => ({ adapter, assessment: adapter.assess(config) }))
      .filter((entry) => entry.assessment.supported)
      .sort((a, b) => b.assessment.priority - a.assessment.priority);

    if (ranked.length > 0) {
      return ranked[0].adapter;
    }

    return adapters[adapters.length - 1];
  }

  diagnose(config: TunnelConnectRequest) {
    return this.createAdapters().map((adapter) => ({
      kind: adapter.kind,
      ...adapter.assess(config),
    }));
  }
}

