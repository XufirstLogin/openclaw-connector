import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackupPasswordDialog } from './components/BackupPasswordDialog';
import { DesktopTitleBar } from './components/DesktopTitleBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FeedbackToast, type FeedbackToastKind } from './components/FeedbackToast';
import { ImportPreviewDialog } from './components/ImportPreviewDialog';
import {
  deleteLocalServer,
  exportLocalServersToDialog,
  importLocalServersFromDialog,
  loadLocalProfile,
  markLocalServerConnected,
  previewImportLocalServersFromDialog,
  saveLocalServer,
  setDefaultLocalServer,
} from './lib/localProfileClient';
import { describeTunnelFailure } from './lib/connectionMessages';
import { connectTunnel, disconnectTunnel, getTunnelStatus, openGui, subscribeTunnelStatus } from './lib/tunnelClient';
import { AboutPage } from './pages/AboutPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { LocalWorkspacePage } from './pages/LocalWorkspacePage';
import { ServerEditorPage } from './pages/ServerEditorPage';
import { SettingsPage } from './pages/SettingsPage';
import { readLocalAppPreferences, writeLocalAppPreferences, type AppTheme } from './state/authStore';
import type { AppView, ConnectionVisualState, EditorMode } from './types/app';
import type { AppMetadata, DiagnosticsLogEntry, ImportPreviewResult } from './types/bridge';
import {
  LOCAL_PROFILE_VERSION,
  type LocalProfileDocument,
  type LocalServerRecord,
  type SaveLocalServerInput,
} from './types/localProfile';

type AppFeedbackState = {
  open: boolean;
  kind: FeedbackToastKind;
  title: string;
  message: string;
};

type EditorState = {
  mode: EditorMode;
  serverId: string | null;
};

type BackupDialogMode = 'import' | 'export';

const CONNECT_SUCCESS_NOTICE = '连接成功，现可打开 OpenClaw。';
const DISCONNECT_SUCCESS_NOTICE = '已断开连接。';
const DISCONNECT_FAILURE_NOTICE = '断开连接失败，请稍后重试。';
const OPEN_GUI_FAILURE_NOTICE = '打开 OpenClaw 失败，请稍后重试。';

function createEmptyProfile(): LocalProfileDocument {
  const now = new Date().toISOString();
  return {
    version: LOCAL_PROFILE_VERSION,
    createdAt: now,
    updatedAt: now,
    servers: [],
  };
}

const emptyFeedback: AppFeedbackState = {
  open: false,
  kind: 'info',
  title: '',
  message: '',
};

function resolvePreferredServerId(profile: LocalProfileDocument, currentSelectedId: string | null) {
  if (profile.servers.length === 0) {
    return null;
  }

  const preferredSelectedId = readLocalAppPreferences().lastSelectedServerId;
  if (currentSelectedId && profile.servers.some((server) => server.id === currentSelectedId)) {
    return currentSelectedId;
  }

  if (preferredSelectedId && profile.servers.some((server) => server.id === preferredSelectedId)) {
    return preferredSelectedId;
  }

  return profile.servers.find((server) => server.isDefault)?.id ?? profile.servers[0]?.id ?? null;
}

function resolveSavedServerId(
  previousProfile: LocalProfileDocument,
  nextProfile: LocalProfileDocument,
  input: SaveLocalServerInput,
) {
  if (input.id && nextProfile.servers.some((server) => server.id === input.id)) {
    return input.id;
  }

  const previousIds = new Set(previousProfile.servers.map((server) => server.id));
  const newlyAdded = nextProfile.servers.find((server) => !previousIds.has(server.id));
  if (newlyAdded) {
    return newlyAdded.id;
  }

  return nextProfile.servers
    .slice()
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0]?.id ?? null;
}

function formatDiagnostics(entries: DiagnosticsLogEntry[]) {
  return entries
    .map((entry) => `[${entry.timestamp}] [${entry.level}] ${entry.event} - ${entry.message}${entry.serverName ? ` (${entry.serverName})` : ''}`)
    .join('\n');
}

export function App() {
  const [view, setView] = useState<AppView>('workspace');
  const [editorState, setEditorState] = useState<EditorState>({ mode: 'create', serverId: null });
  const [status, setStatus] = useState<ConnectionVisualState>('disconnected');
  const [statusServerId, setStatusServerId] = useState<string | null>(null);
  const [statusServerName, setStatusServerName] = useState<string | null>(null);
  const [statusServerIp, setStatusServerIp] = useState<string | null>(null);
  const [statusReason, setStatusReason] = useState<string | null>(null);
  const [profile, setProfile] = useState<LocalProfileDocument>(() => createEmptyProfile());
  const [selectedServerId, setSelectedServerId] = useState<string | null>(() => readLocalAppPreferences().lastSelectedServerId);
  const [feedback, setFeedback] = useState<AppFeedbackState>(emptyFeedback);
  const [activeConnectionServerId, setActiveConnectionServerId] = useState<string | null>(null);
  const [busyServerId, setBusyServerId] = useState<string | null>(null);
  const [backupDialogMode, setBackupDialogMode] = useState<BackupDialogMode | null>(null);
  const [autostartEnabled, setAutostartEnabledState] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [diagnosticsEntries, setDiagnosticsEntries] = useState<DiagnosticsLogEntry[]>([]);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [appMetadata, setAppMetadata] = useState<AppMetadata | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [importingPreviewedBackup, setImportingPreviewedBackup] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => readLocalAppPreferences().theme);
  const backupPasswordResolverRef = useRef<((value: string | null) => void) | null>(null);
  const previousTunnelStatusRef = useRef<ConnectionVisualState>('disconnected');
  const pendingImportPasswordRef = useRef('');

  const appVersion = appMetadata?.version ?? window.openclawDesktop?.version ?? '0.1.0';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    const next: AppTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    writeLocalAppPreferences({ theme: next });
  };

  const showFeedback = (kind: FeedbackToastKind, title: string, message: string) => {
    setFeedback({ open: true, kind, title, message });
  };

  const requestBackupPassword = (mode: BackupDialogMode) => new Promise<string | null>((resolve) => {
    backupPasswordResolverRef.current = resolve;
    setBackupDialogMode(mode);
  });

  const handleBackupDialogCancel = () => {
    backupPasswordResolverRef.current?.(null);
    backupPasswordResolverRef.current = null;
    setBackupDialogMode(null);
  };

  const handleBackupDialogConfirm = (password: string) => {
    backupPasswordResolverRef.current?.(password);
    backupPasswordResolverRef.current = null;
    setBackupDialogMode(null);
  };

  const selectServer = (serverId: string | null) => {
    setSelectedServerId(serverId);
    writeLocalAppPreferences({ lastSelectedServerId: serverId });
  };

  const loadDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    try {
      const entries = await window.openclawDesktop?.diagnostics?.listDiagnostics?.();
      setDiagnosticsEntries(entries ?? []);
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocalProfile()
      .then((nextProfile) => {
        setProfile(nextProfile);
        selectServer(resolvePreferredServerId(nextProfile, selectedServerId));
      })
      .catch((loadError) => {
        showFeedback('error', '加载失败', loadError instanceof Error ? loadError.message : '加载本地服务器失败。');
      });

    void getTunnelStatus()
      .then((snapshot) => {
        previousTunnelStatusRef.current = snapshot.status;
        setStatus(snapshot.status);
        setStatusServerId(snapshot.serverId ?? null);
        setStatusServerName(snapshot.serverName ?? null);
        setStatusServerIp(snapshot.serverIp ?? null);
        setStatusReason(snapshot.reason ?? null);
        setBusyServerId(snapshot.status === 'connecting' || snapshot.status === 'disconnecting' ? snapshot.serverId ?? null : null);
        setActiveConnectionServerId(snapshot.status === 'connected' ? snapshot.serverId ?? null : null);
      })
      .catch(() => undefined);

    const appMetadataRequest = window.openclawDesktop?.app?.getMetadata?.();
    appMetadataRequest
      ?.then((metadata) => {
        setAppMetadata(metadata);
      })
      .catch(() => undefined);

    const autostartRequest = window.openclawDesktop?.settings?.getAutostartEnabled?.();
    autostartRequest
      ?.then((enabled) => {
        setAutostartEnabledState(Boolean(enabled));
      })
      .catch(() => undefined);

    const unsubscribe = subscribeTunnelStatus((snapshot) => {
      const previousStatus = previousTunnelStatusRef.current;
      previousTunnelStatusRef.current = snapshot.status;

      setStatus(snapshot.status);
      setStatusServerId(snapshot.serverId ?? null);
      setStatusServerName(snapshot.serverName ?? null);
      setStatusServerIp(snapshot.serverIp ?? null);
      setStatusReason(snapshot.reason ?? null);
      setBusyServerId(snapshot.status === 'connecting' || snapshot.status === 'disconnecting' ? snapshot.serverId ?? null : null);
      setActiveConnectionServerId(snapshot.status === 'connected' ? snapshot.serverId ?? null : null);

      if (snapshot.status === 'error') {
        setBusyServerId(null);
        setActiveConnectionServerId(null);
        if (previousStatus === 'connected') {
          showFeedback('error', '连接已断开', describeTunnelFailure(snapshot.reason ?? 'SSH 隧道已断开，请重新连接。'));
        }
      }

      if (snapshot.status === 'disconnected') {
        setBusyServerId(null);
        setActiveConnectionServerId(null);
        setStatusServerId(null);
        setStatusServerName(null);
        setStatusServerIp(null);
        setStatusReason(null);
      }
    });

    const unsubscribeNavigate = window.openclawDesktop?.app?.onNavigate?.((target) => {
      setView(target);
      if (target === 'diagnostics') {
        void loadDiagnostics();
      }
    });

    return () => {
      unsubscribe();
      unsubscribeNavigate?.();
    };
  }, []);

  useEffect(() => {
    const nextSelectedId = resolvePreferredServerId(profile, selectedServerId);
    if (nextSelectedId != selectedServerId) {
      selectServer(nextSelectedId);
    }
  }, [profile]);

  useEffect(() => {
    if (!feedback.open) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFeedback((current) => ({ ...current, open: false }));
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [feedback.open, feedback.message]);

  useEffect(() => {
    if (view === 'diagnostics') {
      void loadDiagnostics();
    }
  }, [view, loadDiagnostics]);

  const selectedServer = useMemo(
    () => profile.servers.find((server) => server.id === selectedServerId) ?? null,
    [profile.servers, selectedServerId],
  );

  const activeConnectionServer = useMemo(
    () => profile.servers.find((server) => server.id === activeConnectionServerId) ?? null,
    [profile.servers, activeConnectionServerId],
  );

  const editorSourceServer = useMemo(
    () => profile.servers.find((server) => server.id === editorState.serverId) ?? selectedServer,
    [editorState.serverId, profile.servers, selectedServer],
  );

  const detailStatus = useMemo<ConnectionVisualState>(() => {
    if (!selectedServer) {
      return 'disconnected';
    }

    if (selectedServer.id === statusServerId || selectedServer.id === activeConnectionServerId) {
      return status;
    }

    return 'disconnected';
  }, [activeConnectionServerId, selectedServer, status, statusServerId]);

  const isConnectionBusy = status === 'connecting' || status === 'connected' || status === 'disconnecting';
  const connectionLockedMessage = '当前已有服务器连接中，请先断开后再测试或保存配置。';
  const isServerConnectionBusy = (serverId: string | null | undefined) => Boolean(
    serverId && (
      serverId === activeConnectionServerId
      || serverId === busyServerId
      || (serverId === statusServerId && (status === 'connecting' || status === 'connected' || status === 'disconnecting'))
    )
  );

  const fallbackStatusServer = useMemo(
    () => profile.servers.find((server) => server.id === statusServerId) ?? null,
    [profile.servers, statusServerId],
  );

  const connectionStatusLabel = useMemo(() => {
    switch (status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中';
      case 'disconnecting':
        return '断开中';
      case 'error':
        return '连接异常';
      default:
        return '未连接';
    }
  }, [status]);

  const connectionTargetLabel = useMemo(() => (
    statusServerName?.trim()
      || activeConnectionServer?.name
      || fallbackStatusServer?.name
      || statusServerIp
      || fallbackStatusServer?.serverIp
      || '未连接服务器'
  ), [activeConnectionServer?.name, fallbackStatusServer?.name, fallbackStatusServer?.serverIp, statusServerIp, statusServerName]);

  const shellTitle = view === 'editor'
    ? editorState.mode === 'create'
      ? '新建服务器'
      : editorState.mode === 'duplicate'
        ? '复制服务器'
        : '编辑服务器'
    : view === 'settings'
      ? '设置中心'
      : view === 'diagnostics'
        ? '连接诊断'
        : '服务器工作区';

  const handleSaveServer = async (input: SaveLocalServerInput) => {
    try {
      const previousProfile = profile;
      const nextProfile = await saveLocalServer(input);
      const savedId = resolveSavedServerId(previousProfile, nextProfile, input);
      setProfile(nextProfile);
      selectServer(savedId);
      setView('workspace');
      showFeedback('success', input.id ? '已更新' : '已创建', input.id ? '服务器配置已更新。' : '服务器配置已创建。');
    } catch (error) {
      showFeedback('error', '保存失败', error instanceof Error ? error.message : '服务器配置保存失败，请稍后重试。');
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (isServerConnectionBusy(id)) {
      showFeedback('error', '无法删除', '请先断开当前连接后再删除服务器。');
      return;
    }

    try {
      const nextProfile = await deleteLocalServer(id);
      if (activeConnectionServerId === id) {
        setActiveConnectionServerId(null);
        setBusyServerId(null);
        setStatus('disconnected');
        setStatusServerId(null);
      }
      if (editorState.serverId === id) {
        setView('workspace');
        setEditorState({ mode: 'create', serverId: null });
      }
      setProfile(nextProfile);
      showFeedback('success', '已删除', '服务器已删除。');
    } catch (error) {
      showFeedback('error', '删除失败', error instanceof Error ? error.message : '服务器删除失败，请稍后重试。');
    }
  };

  const handleSetDefault = async (server: LocalServerRecord) => {
    try {
      const nextProfile = await setDefaultLocalServer(server.id);
      setProfile(nextProfile);
      showFeedback('success', '默认服务器', '默认服务器已更新。');
    } catch (error) {
      showFeedback('error', '设置失败', error instanceof Error ? error.message : '默认服务器设置失败，请稍后重试。');
    }
  };

  const handleConnectServer = async (server: LocalServerRecord) => {
    setStatus('connecting');
    setStatusServerId(server.id);
    setStatusServerName(server.name || null);
    setStatusServerIp(server.serverIp);
    setStatusReason(null);
    setBusyServerId(server.id);

    try {
      const response = await connectTunnel(server);

      // After the await, the subscription may have already pushed a different
      // status (e.g. 'error' or 'disconnected'). Check whether we are still
      // the relevant connection before overwriting state.
      const currentStatus = previousTunnelStatusRef.current;
      if (currentStatus === 'error' || currentStatus === 'disconnected') {
        setBusyServerId(null);
        return;
      }

      if (!response.connected) {
        setStatus('error');
        setBusyServerId(null);
        showFeedback('error', '连接失败', describeTunnelFailure(response.reason));
        return;
      }

      const nextProfile = await markLocalServerConnected(server.id);
      setProfile(nextProfile);
      setActiveConnectionServerId(server.id);
      setBusyServerId(null);
      setStatus('connected');
      selectServer(server.id);
      showFeedback('success', '连接成功', CONNECT_SUCCESS_NOTICE);
    } catch (error) {
      setStatus('error');
      setBusyServerId(null);
      showFeedback('error', '连接失败', describeTunnelFailure(error instanceof Error ? error.message : ''));
    }
  };

  const handleDisconnect = async () => {
    const disconnectServerId = activeConnectionServerId ?? statusServerId;
    setStatus('disconnecting');
    setStatusServerId(disconnectServerId);
    setStatusReason(null);
    setBusyServerId(disconnectServerId);

    try {
      await disconnectTunnel();
      setStatus('disconnected');
      setActiveConnectionServerId(null);
      setBusyServerId(null);
      showFeedback('info', '已断连', DISCONNECT_SUCCESS_NOTICE);
    } catch {
      setStatus('error');
      setBusyServerId(null);
      showFeedback('error', '断开失败', DISCONNECT_FAILURE_NOTICE);
    }
  };

  const handleOpenGui = async (server: LocalServerRecord) => {
    try {
      await openGui(server.openclawToken);
      showFeedback('info', '正在打开', `正在打开 ${server.name || server.serverIp} 的 OpenClaw。`);
    } catch {
      showFeedback('error', '打开失败', OPEN_GUI_FAILURE_NOTICE);
    }
  };

  const handleToggleAutostart = async () => {
    if (autostartLoading) {
      return;
    }

    const targetEnabled = !autostartEnabled;
    setAutostartLoading(true);
    try {
      const result = await window.openclawDesktop?.settings?.setAutostartEnabled?.(targetEnabled);
      const nextEnabled = result?.enabled ?? targetEnabled;
      setAutostartEnabledState(nextEnabled);
      showFeedback('success', '启动设置已更新', nextEnabled ? '已开启开机自动启动。' : '已关闭开机自动启动。');
    } catch {
      showFeedback('error', '更新失败', '开机自动启动设置失败，请稍后重试。');
    } finally {
      setAutostartLoading(false);
    }
  };

  const handleImportFromDialog = async () => {
    const backupPassword = await requestBackupPassword('import');
    if (backupPassword === null) {
      return { canceled: true };
    }

    const previewImport = await previewImportLocalServersFromDialog(backupPassword);
    if (previewImport.totalCount === 0) {
      return { canceled: true };
    }

    pendingImportPasswordRef.current = backupPassword;
    setImportPreview(previewImport);
    return { canceled: false };
  };

  const handleConfirmImportPreview = async () => {
    if (!importPreview) {
      return;
    }

    setImportingPreviewedBackup(true);
    try {
      const result = await importLocalServersFromDialog(pendingImportPasswordRef.current);
      if (!result.canceled && result.profile) {
        setProfile(result.profile);
        selectServer(resolvePreferredServerId(result.profile, selectedServerId));
        const importedCount = result.importedCount ?? 0;
        const duplicateCount = importPreview.duplicateCount;
        showFeedback(
          'success',
          '导入完成',
          importedCount > 0
            ? `已导入 ${importedCount} 台服务器，重复 ${duplicateCount} 台已自动跳过。`
            : `未导入新服务器，${duplicateCount} 台重复服务器已跳过。`,
        );
      }
      setImportPreview(null);
      pendingImportPasswordRef.current = '';
      return result;
    } finally {
      setImportingPreviewedBackup(false);
    }
  };

  const handleCancelImportPreview = () => {
    setImportPreview(null);
    pendingImportPasswordRef.current = '';
  };

  const handleExportToDialog = async () => {
    const backupPassword = await requestBackupPassword('export');
    if (backupPassword === null) {
      return { canceled: true };
    }

    const result = await exportLocalServersToDialog(backupPassword);
    if (!result.canceled) {
      const exportedCount = result.exportedCount ?? profile.servers.length;
      const suffix = result.filePath ? `
${result.filePath}` : '';
      showFeedback('success', '导出完成', `已导出 ${exportedCount} 台服务器加密备份。${suffix}`.trim());
    }
    return result;
  };

  const handleCopyDiagnostics = async () => {
    const text = formatDiagnostics(diagnosticsEntries);
    if (!text) {
      showFeedback('info', '暂无日志', '当前没有可复制的连接日志。');
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      showFeedback('success', '复制成功', '连接日志已复制到剪贴板。');
      return;
    }

    showFeedback('error', '复制失败', '当前系统不支持剪贴板复制。');
  };

  const handleClearDiagnostics = async () => {
    await window.openclawDesktop?.diagnostics?.clearDiagnostics?.();
    setDiagnosticsEntries([]);
    showFeedback('success', '已清空', '连接日志已清空。');
  };

  const openCreateEditor = () => {
    setEditorState({ mode: 'create', serverId: null });
    setView('editor');
  };

  const openEditEditor = (server: LocalServerRecord) => {
    selectServer(server.id);
    setEditorState({ mode: 'edit', serverId: server.id });
    setView('editor');
  };

  const openDuplicateEditor = (server: LocalServerRecord) => {
    selectServer(server.id);
    setEditorState({ mode: 'duplicate', serverId: server.id });
    setView('editor');
  };

  return (
    <div className="desktop-app-shell">
      <DesktopTitleBar
        title={shellTitle}
        onMinimize={() => { void window.openclawDesktop?.windowControls?.minimize?.(); }}
        onClose={() => { void window.openclawDesktop?.windowControls?.close?.(); }}
      />

      <main className="desktop-app-shell__content">
        <ErrorBoundary>
        {view === 'workspace' ? (
          <LocalWorkspacePage
            profile={profile}
            selectedId={selectedServerId}
            detailStatus={detailStatus}
            activeConnectionServer={activeConnectionServer}
            busyServerId={busyServerId}
            connectionStatusLabel={connectionStatusLabel}
            connectionTargetLabel={connectionTargetLabel}
            onSelectServer={selectServer}
            onConnectServer={handleConnectServer}
            onDisconnect={handleDisconnect}
            onOpenGui={handleOpenGui}
            onSetDefault={handleSetDefault}
            onImportFromDialog={handleImportFromDialog}
            onExportToDialog={handleExportToDialog}
            onCreateServer={openCreateEditor}
            onOpenSettings={() => setView('settings')}
            onOpenDiagnostics={() => setView('diagnostics')}
            onEditServer={openEditEditor}
            onDuplicateServer={openDuplicateEditor}
            onDeleteServer={handleDeleteServer}
          />
        ) : view === 'settings' ? (
          <SettingsPage
            version={appVersion}
            metadata={appMetadata}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            autostartEnabled={autostartEnabled}
            autostartLoading={autostartLoading}
            onToggleAutostart={handleToggleAutostart}
            onBack={() => setView('workspace')}
            onOpenDiagnostics={() => setView('diagnostics')}
            onImportBackup={handleImportFromDialog}
            onExportBackup={handleExportToDialog}
          />
        ) : view === 'diagnostics' ? (
          <DiagnosticsPage
            entries={diagnosticsEntries}
            loading={diagnosticsLoading}
            onBack={() => setView('workspace')}
            onRefresh={loadDiagnostics}
            onCopy={handleCopyDiagnostics}
            onClear={handleClearDiagnostics}
          />
        ) : (
          <ServerEditorPage
            mode={editorState.mode}
            sourceServer={editorSourceServer}
            connectionLocked={isConnectionBusy}
            connectionLockedMessage={connectionLockedMessage}
            onBack={() => setView('workspace')}
            onSave={handleSaveServer}
          />
        )}
        </ErrorBoundary>

        <div style={{ display: 'none' }} aria-hidden="true">
          <AboutPage
            embedded
            version={appVersion}
            metadata={appMetadata}
            autostartEnabled={autostartEnabled}
            autostartLoading={autostartLoading}
            onToggleAutostart={handleToggleAutostart}
            onExportBackup={handleExportToDialog}
          />
        </div>
      </main>

      <FeedbackToast
        open={feedback.open}
        kind={feedback.kind}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback((current) => ({ ...current, open: false }))}
      />

      <BackupPasswordDialog
        open={Boolean(backupDialogMode)}
        mode={backupDialogMode ?? 'export'}
        onConfirm={handleBackupDialogConfirm}
        onCancel={handleBackupDialogCancel}
      />

      <ImportPreviewDialog
        open={Boolean(importPreview)}
        preview={importPreview}
        importing={importingPreviewedBackup}
        onCancel={handleCancelImportPreview}
        onConfirm={() => { void handleConfirmImportPreview(); }}
      />
    </div>
  );
}
