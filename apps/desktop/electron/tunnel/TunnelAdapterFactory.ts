import { TunnelConnectRequest } from '../../src/types/bridge';
import { CommandSshTunnelAdapter } from './adapters/CommandSshTunnelAdapter';
import { MockTunnelAdapter } from './adapters/MockTunnelAdapter';
import { Ssh2TunnelAdapter } from './adapters/Ssh2TunnelAdapter';
import { TunnelAdapter } from './adapters/TunnelAdapter';

export class TunnelAdapterFactory {
  private readonly adapters: TunnelAdapter[] = [
    new Ssh2TunnelAdapter(),
    new CommandSshTunnelAdapter(),
    new MockTunnelAdapter(),
  ];

  pick(config: TunnelConnectRequest): TunnelAdapter {
    const ranked = this.adapters
      .map((adapter) => ({ adapter, assessment: adapter.assess(config) }))
      .filter((entry) => entry.assessment.supported)
      .sort((a, b) => b.assessment.priority - a.assessment.priority);

    if (ranked.length > 0) {
      return ranked[0].adapter;
    }

    return this.adapters[this.adapters.length - 1];
  }

  diagnose(config: TunnelConnectRequest) {
    return this.adapters.map((adapter) => ({
      kind: adapter.kind,
      ...adapter.assess(config),
    }));
  }
}

