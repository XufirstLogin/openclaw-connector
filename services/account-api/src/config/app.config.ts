export interface AppConfig {
  port: number;
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  appCryptoKey: string;
  authDebugCodeEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpEnabled: boolean;
  smtpTlsRejectUnauthorized: boolean;
}

export function loadConfig(): AppConfig {
  const authDebugCodeEnabled = process.env.AUTH_DEBUG_CODE_ENABLED
    ? process.env.AUTH_DEBUG_CODE_ENABLED.toLowerCase() === 'true'
    : process.env.NODE_ENV === 'test';
  const smtpHost = process.env.SMTP_HOST ?? '';
  const smtpPort = Number(process.env.SMTP_PORT ?? 465);
  const smtpUser = process.env.SMTP_USER ?? '';
  const smtpPass = process.env.SMTP_PASS ?? '';
  const smtpFrom = process.env.SMTP_FROM ?? '';
  const smtpTlsRejectUnauthorized = (process.env.SMTP_TLS_REJECT_UNAUTHORIZED ?? 'true').toLowerCase() !== 'false';

  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: process.env.DATABASE_URL ?? '',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'openclaw-access-secret',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'openclaw-refresh-secret',
    appCryptoKey: process.env.APP_CRYPTO_KEY ?? 'openclaw-dev-secret',
    authDebugCodeEnabled,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    smtpEnabled: Boolean(smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom),
    smtpTlsRejectUnauthorized,
  };
}
