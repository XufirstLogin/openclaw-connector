export interface SaveServerConfigDto {
  serverIp: string;
  sshPort: number;
  sshUsername: string;
  authType: 'password' | 'key';
  sshPassword?: string;
  sshPrivateKey?: string;
  openclawToken: string;
}
