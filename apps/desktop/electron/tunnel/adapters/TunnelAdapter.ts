import { TunnelConnectRequest, TunnelConnectResult, TunnelStateSnapshot } from '../../src/types/bridge';

export type TunnelAdapterKind = 'mock' | 'ssh-command' | 'ssh2';

export interface TunnelAdapterAssessment {
  supported: boolean;
  priority: number;
  reason?: string;
}

export interface TunnelAdapter {
  readonly kind: TunnelAdapterKind;
  assess(config: TunnelConnectRequest): TunnelAdapterAssessment;
  connect(config: TunnelConnectRequest): Promise<TunnelConnectResult>;
  disconnect(): Promise<void>;
  getSnapshot(): Partial<TunnelStateSnapshot>;
}
