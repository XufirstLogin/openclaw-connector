import React from 'react';
import { ConnectionVisualState } from '../types/app';
import { Button, GlassCard, StatusBadge } from './ui';

type ConnectionStatusCardProps = {
  status: ConnectionVisualState;
  activeServerName?: string;
  serverIp: string;
  sshUsername: string;
  authType: 'password' | 'key';
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenGui: () => void;
};

export function ConnectionStatusCard({
  status,
  activeServerName,
  serverIp,
  sshUsername,
  authType,
  onConnect,
  onDisconnect,
  onOpenGui,
}: ConnectionStatusCardProps) {
  const canConnect = status === 'disconnected' || status === 'error';
  const canDisconnect = status === 'connected' || status === 'connecting';
  const canOpenGui = status === 'connected';
  const isBusy = status === 'connecting' || status === 'disconnecting';
  const connectLabel = status === 'connecting' ? '连接中...' : '连接';
  const disconnectLabel = status === 'disconnecting' ? '断开中...' : '断连';

  return (
    <GlassCard
      title="连接状态"
      subtitle="管理 SSH 隧道与 OpenClaw GUI 跳转"
      actions={<StatusBadge status={status} />}
    >
      <div className="status-card-grid">
        <div className="status-meta">
          <div>
            <span className="meta-label">当前服务器</span>
            <strong className="meta-value">{activeServerName || `${sshUsername}@${serverIp}`}</strong>
          </div>
          <div>
            <span className="meta-label">认证方式</span>
            <strong className="meta-value">{authType === 'password' ? '密码认证' : '私钥认证'}</strong>
          </div>
        </div>
        <div className="panel-actions panel-actions--row">
          <Button onClick={onConnect} disabled={!canConnect || isBusy}>{connectLabel}</Button>
          <Button variant="danger" onClick={onDisconnect} disabled={!canDisconnect || isBusy}>{disconnectLabel}</Button>
          <Button variant="secondary" onClick={onOpenGui} disabled={!canOpenGui || isBusy}>打开 GUI</Button>
        </div>
      </div>
    </GlassCard>
  );
}
