function normalizeReason(reason?: string) {
  return (reason ?? '').trim().toLowerCase();
}

function includesAny(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function withDiagnosticsHint(message: string) {
  return `${message} 如需进一步排查，请前往诊断页查看连接日志。`;
}

export function describeTunnelFailure(reason?: string) {
  const normalized = normalizeReason(reason);

  if (!normalized) {
    return withDiagnosticsHint('连接失败，请检查公网 IP、SSH 用户名、认证方式与网络连通性。');
  }

  if (includesAny(normalized, [
    'permission denied',
    'authentication',
    'authenticate',
    'auth fail',
    'all configured authentication methods failed',
    'access denied',
  ])) {
    return withDiagnosticsHint('SSH 认证失败，请检查用户名、密码或私钥是否正确。');
  }

  if (includesAny(normalized, ['timed out', 'timeout', 'etimedout', 'handshake timeout'])) {
    return withDiagnosticsHint('SSH 连接超时，请检查公网 IP、SSH 端口、安全组、防火墙和网络是否放行。');
  }

  if (includesAny(normalized, ['econnrefused', 'connection refused', 'connect failed', 'actively refused'])) {
    return withDiagnosticsHint('服务器拒绝连接，请检查公网 IP、SSH 服务是否启动，以及安全组或防火墙是否放行。');
  }

  if (includesAny(normalized, ['ehostunreach', 'enetunreach', 'no route to host', 'network is unreachable'])) {
    return withDiagnosticsHint('网络不可达，请检查公网 IP 是否正确，以及服务器所在网络是否可访问。');
  }

  if (includesAny(normalized, ['getaddrinfo', 'enotfound', 'host not found', 'name or service not known'])) {
    return withDiagnosticsHint('无法解析服务器地址，请检查公网 IP 或域名是否填写正确。');
  }

  if (includesAny(normalized, ['eaddrinuse', 'address already in use', 'port 18789'])) {
    return '本地端口 18789 已被占用，请先关闭冲突程序后再重试。';
  }

  if (includesAny(normalized, ['already connected', 'already have active connection', 'active connection'])) {
    return '当前已有服务器连接中，请先断开现有连接后再试。';
  }

  if (includesAny(normalized, ['private key', 'invalid key', 'unsupported key format', 'encrypted private key'])) {
    return withDiagnosticsHint('SSH 私钥不可用，请检查私钥内容、格式与口令设置。');
  }

  if (includesAny(normalized, ['openclawtoken', 'openclaw token', 'token'])) {
    return withDiagnosticsHint('OpenClaw Token 无效或格式异常，请检查后重新填写。');
  }

  return withDiagnosticsHint('连接失败，请检查公网 IP、SSH 配置和 OpenClaw Token 是否正确。');
}
