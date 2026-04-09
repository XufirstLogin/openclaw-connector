import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ServerCardList } from '../components/ServerCardList';
import { ServerDetailPanel } from '../components/ServerDetailPanel';
import { Button, Field, TextInput } from '../components/ui';
import type { ConnectionVisualState } from '../types/app';
import type { ExportToDialogResult, ImportFromDialogResult } from '../types/bridge';
import type { LocalProfileDocument, LocalServerRecord } from '../types/localProfile';

type LocalWorkspacePageProps = {
  profile: LocalProfileDocument;
  selectedId: string | null;
  detailStatus: ConnectionVisualState;
  activeConnectionServer: LocalServerRecord | null;
  busyServerId?: string | null;
  connectionStatusLabel: string;
  connectionTargetLabel: string;
  onSelectServer: (id: string) => void;
  onConnectServer: (server: LocalServerRecord) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onOpenGui: (server: LocalServerRecord) => Promise<void>;
  onSetDefault: (server: LocalServerRecord) => Promise<void>;
  onImportFromDialog: () => Promise<ImportFromDialogResult>;
  onExportToDialog: () => Promise<ExportToDialogResult>;
  onCreateServer: () => void;
  onOpenSettings: () => void;
  onOpenDiagnostics: () => void;
  onEditServer: (server: LocalServerRecord) => void;
  onDuplicateServer: (server: LocalServerRecord) => void;
  onDeleteServer: (id: string) => Promise<void>;
};

export function LocalWorkspacePage({
  profile,
  selectedId,
  detailStatus,
  activeConnectionServer,
  busyServerId,
  connectionStatusLabel,
  connectionTargetLabel,
  onSelectServer,
  onConnectServer,
  onDisconnect,
  onOpenGui,
  onSetDefault,
  onImportFromDialog,
  onExportToDialog,
  onCreateServer,
  onOpenSettings,
  onOpenDiagnostics,
  onEditServer,
  onDuplicateServer,
  onDeleteServer,
}: LocalWorkspacePageProps) {
  const [search, setSearch] = useState('');
  const [panelError, setPanelError] = useState('');
  const [confirmDeleteServer, setConfirmDeleteServer] = useState<LocalServerRecord | null>(null);

  const filteredServers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return profile.servers;
    }

    return profile.servers.filter((server) => {
      const haystack = [server.name, server.remark, server.serverIp, server.sshUsername].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }, [profile.servers, search]);

  const selectedServer = useMemo(
    () => profile.servers.find((server) => server.id === selectedId) ?? null,
    [profile.servers, selectedId],
  );

  const defaultServer = useMemo(
    () => profile.servers.find((server) => server.isDefault) ?? null,
    [profile.servers],
  );

  useEffect(() => {
    if (confirmDeleteServer && !profile.servers.some((server) => server.id === confirmDeleteServer.id)) {
      setConfirmDeleteServer(null);
    }
  }, [confirmDeleteServer, profile.servers]);

  const handleImportClick = async () => {
    setPanelError('');
    try {
      await onImportFromDialog();
    } catch (importError) {
      setPanelError(importError instanceof Error ? importError.message : '导入失败。');
    }
  };

  const handleExportClick = async () => {
    setPanelError('');
    try {
      await onExportToDialog();
    } catch (exportError) {
      setPanelError(exportError instanceof Error ? exportError.message : '导出失败。');
    }
  };

  const cannotDeleteActiveServer = (server: LocalServerRecord | null | undefined) => Boolean(
    server && (server.id === activeConnectionServer?.id || server.id === busyServerId)
  );

  const handleRequestDelete = (server: LocalServerRecord) => {
    setPanelError('');
    if (cannotDeleteActiveServer(server)) {
      setConfirmDeleteServer(null);
      setPanelError('请先断开当前连接后再删除服务器。');
      return;
    }
    setConfirmDeleteServer(server);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteServer) {
      return;
    }

    if (cannotDeleteActiveServer(confirmDeleteServer)) {
      setConfirmDeleteServer(null);
      setPanelError('请先断开当前连接后再删除服务器。');
      return;
    }

    await onDeleteServer(confirmDeleteServer.id);
    setConfirmDeleteServer(null);
  };

  return (
    <>
      <div className="app-page workspace-home">
        <section className="workspace-toolbar glass-card">
          <div className="workspace-toolbar__hero">
            <div className="workspace-toolbar__identity">
              <div className="workspace-toolbar__copy">
                <span className="page-heading__eyebrow">本地模式</span>
                <h1 className="workspace-toolbar__title">服务器工作区</h1>
                <p className="workspace-toolbar__desc">把常用服务器集中保存在本地，保持一键连接、快速切换、稳定打开 OpenClaw 的成品体验。</p>
              </div>
            </div>
            <div className="workspace-toolbar__quick-actions workspace-toolbar__actions">
              <Button type="button" variant="secondary" onClick={() => { void handleImportClick(); }}>导入</Button>
              <Button type="button" variant="secondary" onClick={() => { void handleExportClick(); }}>导出</Button>
              <Button type="button" variant="ghost" onClick={onOpenDiagnostics}>诊断</Button>
              <Button type="button" variant="ghost" onClick={onOpenSettings}>设置</Button>
              <Button type="button" onClick={onCreateServer}>新建服务器</Button>
            </div>
          </div>

          <div className="workspace-toolbar__metrics workspace-toolbar__summary">
            <div className="workspace-toolbar__metric">
              <span className="workspace-toolbar__metric-label">服务器数量</span>
              <strong className="workspace-toolbar__metric-value">{profile.servers.length}</strong>
              <em className="workspace-toolbar__metric-subtext">已本地加密保存</em>
            </div>
            <div className="workspace-toolbar__metric">
              <span className="workspace-toolbar__metric-label">默认服务器</span>
              <strong className="workspace-toolbar__metric-value">{defaultServer?.name || '未设置'}</strong>
              <em className="workspace-toolbar__metric-subtext">下次启动优先</em>
            </div>
            <div className="workspace-toolbar__metric workspace-toolbar__metric--wide workspace-toolbar__stat--status">
              <span className="workspace-toolbar__metric-label">当前连接</span>
              <strong className="workspace-toolbar__metric-value">{connectionTargetLabel}</strong>
              <em className="workspace-toolbar__status-text">{connectionStatusLabel}</em>
            </div>
          </div>
        </section>

        <div className="workspace-shell">
          <aside className="workspace-sidebar glass-card">
            <div className="workspace-sidebar__body">
              <Field label="搜索服务器" hint={`${profile.servers.length} 台`}>
                <TextInput
                  placeholder="按名称、公网 IP、备注搜索"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </Field>
              <ServerCardList
                servers={filteredServers}
                selectedId={selectedId}
                activeConnectionServerId={activeConnectionServer?.id ?? null}
                busyServerId={busyServerId}
                onSelect={onSelectServer}
                onConnect={(server) => { void onConnectServer(server); }}
                onEdit={onEditServer}
                onDelete={handleRequestDelete}
                onCreateServer={onCreateServer}
                onImportBackup={() => { void handleImportClick(); }}
              />
            </div>
          </aside>

          <main className="workspace-main">
            {panelError ? <div className="banner banner--error">{panelError}</div> : null}
            <ServerDetailPanel
              server={selectedServer}
              status={detailStatus}
              activeConnectionServer={activeConnectionServer}
              busy={Boolean(selectedServer && busyServerId === selectedServer.id)}
              deleteDisabled={cannotDeleteActiveServer(selectedServer)}
              onConnect={(server) => { void onConnectServer(server); }}
              onDisconnect={() => { void onDisconnect(); }}
              onOpenGui={(server) => { void onOpenGui(server); }}
              onEdit={onEditServer}
              onDuplicate={onDuplicateServer}
              onDelete={handleRequestDelete}
              onSetDefault={(server) => { void onSetDefault(server); }}
            />
          </main>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmDeleteServer)}
        title="确认删除"
        message={confirmDeleteServer ? `确定删除服务器“${confirmDeleteServer.name || confirmDeleteServer.serverIp}”吗？删除后不可恢复。` : ''}
        confirmLabel="确认删除"
        cancelLabel="取消"
        onConfirm={() => { void handleConfirmDelete(); }}
        onCancel={() => setConfirmDeleteServer(null)}
      />
    </>
  );
}
