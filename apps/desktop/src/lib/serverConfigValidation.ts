import type { ServerConfigState } from '../state/configStore';

const ipv4Pattern = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const hostnamePattern = /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/;

function isValidServerHost(value: string) {
  if (value.includes('://') || value.includes('/') || /\s/.test(value)) {
    return false;
  }

  return ipv4Pattern.test(value) || hostnamePattern.test(value) || value.includes(':');
}

export function validateServerConfig(config: ServerConfigState) {
  const serverIp = config.serverIp.trim();
  const sshUsername = config.sshUsername.trim();
  const openclawToken = config.openclawToken.trim();
  const sshPassword = config.sshPassword.trim();
  const sshPrivateKey = config.sshPrivateKey.trim();

  if (!serverIp) {
    return '请输入服务器公网 IP';
  }

  if (!isValidServerHost(serverIp)) {
    return '请输入有效的公网 IP 或域名';
  }

  if (!Number.isInteger(config.sshPort) || config.sshPort < 1 || config.sshPort > 65535) {
    return 'SSH 端口必须在 1-65535 之间';
  }

  if (!sshUsername) {
    return '请输入 SSH 用户名';
  }

  if (!openclawToken) {
    return '请输入 OpenClaw Token';
  }

  if (config.authType === 'password' && !sshPassword) {
    return '请输入 SSH 密码';
  }

  if (config.authType === 'key' && !sshPrivateKey) {
    return '请输入 SSH 私钥';
  }

  return null;
}
