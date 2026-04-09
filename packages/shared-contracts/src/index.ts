export type VerificationPurpose = 'register' | 'reset_password' | 'login';

export interface SendCodeRequest {
  email: string;
}

export interface RegisterRequest {
  email: string;
  code: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: {
    email: string;
    emailVerified: boolean;
  };
}

export type AuthType = 'password' | 'key';

export interface SaveServerConfigRequest {
  serverIp: string;
  sshPort: number;
  sshUsername: string;
  authType: AuthType;
  sshPassword?: string;
  sshPrivateKey?: string;
  openclawToken: string;
}

export interface ServerConfigDto {
  serverIp: string;
  sshPort: number;
  sshUsername: string;
  authType: AuthType;
  sshPassword?: string;
  sshPrivateKey?: string;
  openclawToken: string;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export const DEFAULT_LOCAL_OPENCLAW_URL = 'http://127.0.0.1:18789';

export function buildOpenClawGuiUrl(token: string): string {
  return `${DEFAULT_LOCAL_OPENCLAW_URL}/#token=${encodeURIComponent(token)}`;
}
