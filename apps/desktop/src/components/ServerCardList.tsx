import React from 'react';
import type { LocalServerRecord } from '../types/localProfile';
import { Button } from './ui';
import { ServerCard } from './ServerCard';

type ServerCardListProps = {
  servers: LocalServerRecord[];
  selectedId?: string | null;
  activeConnectionServerId?: string | null;
  busyServerId?: string | null;
  onSelect: (id: string) => void;
  onConnect: (server: LocalServerRecord) => void;
  onEdit: (server: LocalServerRecord) => void;
  onDelete: (server: LocalServerRecord) => void;
  onCreateServer?: () => void;
  onImportBackup?: () => void;
};

export function ServerCardList({
  servers,
  selectedId,
  activeConnectionServerId,
  busyServerId,
  onSelect,
  onConnect,
  onEdit,
  onDelete,
  onCreateServer,
  onImportBackup,
}: ServerCardListProps) {
  if (servers.length === 0) {
    return (
      <div className="server-list-empty">
        <strong>还没有本地服务器</strong>
        <p>首次使用可以先新建第一台服务器，或者从以前导出的备份文件中追加导入。</p>
        <div className="server-list-empty__actions">
          <Button type="button" onClick={onCreateServer}>新建第一台服务器</Button>
          <Button type="button" variant="secondary" onClick={onImportBackup}>从备份导入</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="server-card-list">
      {servers.map((server) => {
        const connectDisabled = Boolean(
          (activeConnectionServerId && activeConnectionServerId !== server.id)
          || (busyServerId && busyServerId !== server.id)
        );

        return (
          <ServerCard
            key={server.id}
            server={server}
            selected={server.id === selectedId}
            isActiveConnection={server.id === activeConnectionServerId}
            isConnecting={server.id === busyServerId}
            connectDisabled={connectDisabled}
            deleteDisabled={server.id === activeConnectionServerId || server.id === busyServerId}
            onSelect={() => onSelect(server.id)}
            onConnect={() => onConnect(server)}
            onEdit={() => onEdit(server)}
            onDelete={() => onDelete(server)}
          />
        );
      })}
    </div>
  );
}
