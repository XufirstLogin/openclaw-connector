import React from 'react';
import type { LocalServerRecord } from '../types/localProfile';
import { Button } from './ui';

type ServerCardProps = {
  server: LocalServerRecord;
  selected?: boolean;
  isActiveConnection?: boolean;
  isConnecting?: boolean;
  connectDisabled?: boolean;
  onSelect: () => void;
  onConnect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
};

function formatLastConnected(value: string | null) {
  if (!value) {
    return '未连接';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

export function ServerCard({
  server,
  selected = false,
  isActiveConnection = false,
  isConnecting = false,
  connectDisabled = false,
  onSelect,
  onConnect,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: ServerCardProps) {
  const connectLabel = isConnecting ? '连接中...' : isActiveConnection ? '已连接' : '连接';

  return (
    <article
      className={[
        'server-card',
        selected ? 'server-card--selected' : '',
        isActiveConnection ? 'server-card--connected' : '',
        isConnecting ? 'server-card--connecting' : '',
      ].filter(Boolean).join(' ')}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="server-card__header">
        <div>
          <h3 className="server-card__title">{server.name || server.serverIp}</h3>
          <p className="server-card__subtitle">{server.sshUsername}@{server.serverIp}:{server.sshPort}</p>
        </div>
        <div className="server-card__badges">
          {server.isDefault ? <span className="server-card__badge server-card__badge--default">默认</span> : null}
          {isActiveConnection ? <span className="server-card__badge server-card__badge--connected">已连接</span> : null}
          {isConnecting ? <span className="server-card__badge server-card__badge--connecting">连接中</span> : null}
          <span className="server-card__badge">{server.authType === 'password' ? '密码' : '私钥'}</span>
        </div>
      </div>

      {server.remark ? <p className="server-card__remark">{server.remark}</p> : null}

      <div className="server-card__meta">
        <span>最近连接</span>
        <strong>{formatLastConnected(server.lastConnectedAt)}</strong>
      </div>

      <div className="server-card__actions">
        <Button type="button" className="server-card__action server-card__action--primary" onClick={(event) => { event.stopPropagation(); onConnect(); }} disabled={connectDisabled || isConnecting || isActiveConnection}>
          {connectLabel}
        </Button>
        <Button type="button" variant="secondary" className="server-card__action server-card__action--secondary" onClick={(event) => { event.stopPropagation(); onEdit(); }}>
          编辑
        </Button>
        <Button type="button" variant="ghost" className="server-card__action server-card__action--secondary" onClick={(event) => { event.stopPropagation(); onDelete(); }} disabled={deleteDisabled}>
          删除
        </Button>
      </div>
    </article>
  );
}
