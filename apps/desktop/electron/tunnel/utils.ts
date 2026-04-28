import { existsSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_OPENCLAW_PORT } from '../../src/state/configStore';
import { TunnelConnectRequest } from '../../src/types/bridge';

function resolveOpenClawPort(openclawPort?: number) {
  return Number.isInteger(openclawPort) && openclawPort && openclawPort > 0 ? openclawPort : DEFAULT_OPENCLAW_PORT;
}

export function buildLocalGuiUrl(token: string, openclawPort: number = DEFAULT_OPENCLAW_PORT) {
  const port = resolveOpenClawPort(openclawPort);
  return `http://127.0.0.1:${port}/#token=${encodeURIComponent(token)}`;
}

export function buildSshCommandArgs(config: TunnelConnectRequest, privateKeyPath?: string) {
  const openclawPort = resolveOpenClawPort(config.openclawPort);
  const args = [
    '-N',
    '-L',
    `${openclawPort}:127.0.0.1:${openclawPort}`,
    '-p',
    String(config.sshPort || 22),
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=30',
    '-o',
    'ServerAliveCountMax=3',
    '-o',
    'StrictHostKeyChecking=accept-new',
  ];

  if (config.authType === 'key' && privateKeyPath) {
    args.push('-o', 'BatchMode=yes', '-i', privateKeyPath);
  }

  args.push(`${config.sshUsername}@${config.serverIp}`);
  return args;
}

export function buildSshCommandPreview(
  config: TunnelConnectRequest,
  options?: { includeKeyHint?: boolean; sshPath?: string },
) {
  const openclawPort = resolveOpenClawPort(config.openclawPort);
  const parts = [
    options?.sshPath ?? 'ssh',
    '-N',
    '-L',
    `${openclawPort}:127.0.0.1:${openclawPort}`,
    '-p',
    String(config.sshPort || 22),
    '-o',
    'ExitOnForwardFailure=yes',
  ];

  if (options?.includeKeyHint && config.authType === 'key') {
    parts.push('-i', '<temp-key-file>');
  }

  parts.push(`${config.sshUsername}@${config.serverIp}`);
  return parts.join(' ');
}

export function detectSystemSshPath() {
  const candidates = [
    process.env.SystemRoot ? path.join(process.env.SystemRoot, 'System32', 'OpenSSH', 'ssh.exe') : '',
    process.env.WINDIR ? path.join(process.env.WINDIR, 'System32', 'OpenSSH', 'ssh.exe') : '',
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

