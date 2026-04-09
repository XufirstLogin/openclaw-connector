export class LegacyCloudApiRemovedError extends Error {
  constructor() {
    super('OpenClaw Connector 已切换为本地模式，不再内置账号 API。');
    this.name = 'LegacyCloudApiRemovedError';
  }
}

export function explainLocalOnlyMode() {
  return 'OpenClaw Connector is now a local-only desktop connector.';
}
