export type ServerConfigState = {
  serverIp: string;
  sshPort: number;
  sshUsername: string;
  authType: 'password' | 'key';
  sshPassword: string;
  sshPrivateKey: string;
  openclawToken: string;
};

export const defaultServerConfigState: ServerConfigState = {
  serverIp: '',
  sshPort: 22,
  sshUsername: 'root',
  authType: 'password',
  sshPassword: '',
  sshPrivateKey: '',
  openclawToken: '',
};

export const configStore: { current: ServerConfigState } = {
  current: { ...defaultServerConfigState },
};

export function updateServerConfig(partial: Partial<ServerConfigState>) {
  configStore.current = { ...configStore.current, ...partial };
}

export function replaceServerConfig(next: Partial<ServerConfigState> | null | undefined) {
  configStore.current = {
    ...defaultServerConfigState,
    ...(next ?? {}),
  };
}

export function resetServerConfig() {
  configStore.current = { ...defaultServerConfigState };
}

export function readServerConfig() {
  return { ...configStore.current };
}
