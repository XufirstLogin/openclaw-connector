import React from 'react';
import { buildLocalGuiUrl } from '../lib/tunnelClient';
import type { ConnectionVisualState } from '../types/app';
import type { LocalServerRecord } from '../types/localProfile';
import { Button, GlassCard, StatusBadge } from './ui';

type ServerDetailPanelProps = {
  server: LocalServerRecord | null;
  status: ConnectionVisualState;
  activeConnectionServer: LocalServerRecord | null;
  busy: boolean;
  deleteDisabled?: boolean;
  onConnect: (server: LocalServerRecord) => void;
  onDisconnect: () => void;
  onOpenGui: (server: LocalServerRecord) => void;
  onEdit: (server: LocalServerRecord) => void;
  onDuplicate: (server: LocalServerRecord) => void;
  onDelete: (server: LocalServerRecord) => void;
  onSetDefault: (server: LocalServerRecord) => void;
};

function formatLastConnected(value: string | null) {
  if (!value) {
    return '尚未连接';
  }

  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function ServerDetailPanel({
  server,
  status,
  activeConnectionServer,
  busy,
  deleteDisabled = false,
  onConnect,
  onDisconnect,
  onOpenGui,
  onEdit,
  onDuplicate,
  onDelete,
  onSetDefault,
}: ServerDetailPanelProps) {
  if (!server) {
    return (
      <GlassCard className="server-detail-panel" title="连接详情" subtitle="先从左侧选择一个服务器卡片。">
        <div className="detail-empty-state">
          <strong>暂无选中服务器</strong>
          <p>选择左侧卡片后，这里会展示连接状态、连接信息以及编辑、复制、删除等操作。</p>
        </div>
      </GlassCard>
    );
  }

  const anotherServerActive = Boolean(activeConnectionServer && activeConnectionServer.id !== server.id);
  const canConnect = !anotherServerActive && (status === 'disconnected' || status === 'error');
  const canDisconnect = !anotherServerActive && (status === 'connected' || status === 'connecting' || status === 'disconnecting');
  const canOpenGui = !anotherServerActive && status === 'connected';
  const localMapping = `127.0.0.1:${server.openclawPort} → 127.0.0.1:${server.openclawPort}`;
  const guiUrl = buildLocalGuiUrl('******', server.openclawPort);

  return (
    <GlassCard
      className="server-detail-panel"
      title={server.name || server.serverIp}
      subtitle="查看当前服务器的连接状态与本地映射详情。"
      actions={<StatusBadge status={status} />}
    >
      <div className="server-detail-panel__body">
        {anotherServerActive ? (
          <div className="banner banner--info">
            当前已连接 {activeConnectionServer?.name || activeConnectionServer?.serverIp}，请先断开后再切换连接。
          </div>
        ) : null}

        <div className="server-detail-panel__content">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-item__label">公网地址</span>
              <strong className="detail-item__value">{server.serverIp}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">SSH</span>
              <strong className="detail-item__value">{server.sshUsername}@{server.serverIp}:{server.sshPort}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">认证方式</span>
              <strong className="detail-item__value">{server.authType === 'password' ? '密码认证' : '私钥认证'}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">本地映射</span>
              <strong className="detail-item__value">{localMapping}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">最近连接</span>
              <strong className="detail-item__value">{formatLastConnected(server.lastConnectedAt)}</strong>
            </div>
            <div className="detail-item">
              <span className="detail-item__label">GUI 链接</span>
              <strong className="detail-item__value detail-item__value--mono">{guiUrl}</strong>
            </div>
          </div>

          {server.remark ? (
            <div className="detail-note">
              <span className="detail-item__label">备注</span>
              <p>{server.remark}</p>
            </div>
          ) : null}
        </div>

        <div className="server-detail-panel__footer server-detail-panel__action-stack">
          <div className="server-detail-panel__primary-actions panel-actions panel-actions--row">
            <Button type="button" className="server-detail-panel__action server-detail-panel__action--primary" onClick={() => onConnect(server)} disabled={!canConnect || busy}>连接</Button>
            <Button type="button" variant="secondary" className="server-detail-panel__action server-detail-panel__action--secondary" onClick={() => onOpenGui(server)} disabled={!canOpenGui || busy}>打开 GUI</Button>
            <Button type="button" variant="danger" className="server-detail-panel__action server-detail-panel__action--danger" onClick={onDisconnect} disabled={!canDisconnect || busy}>断连</Button>
          </div>
          <div className="server-detail-panel__secondary-actions panel-actions panel-actions--row">
            <Button type="button" variant="secondary" className="server-detail-panel__action server-detail-panel__action--secondary" onClick={() => onEdit(server)}>编辑</Button>
            <Button type="button" variant="secondary" className="server-detail-panel__action server-detail-panel__action--secondary" onClick={() => onDuplicate(server)}>复制</Button>
            {!server.isDefault ? (
              <Button type="button" variant="ghost" className="server-detail-panel__action server-detail-panel__action--ghost" onClick={() => onSetDefault(server)}>设为默认</Button>
            ) : null}
            <Button type="button" variant="ghost" className="server-detail-panel__action server-detail-panel__action--ghost" onClick={() => onDelete(server)} disabled={deleteDisabled}>删除</Button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

