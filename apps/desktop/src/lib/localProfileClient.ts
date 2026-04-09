import type { ExportToDialogResult, ImportFromDialogResult, ImportPreviewResult } from '../types/bridge';
import {
  LOCAL_PROFILE_VERSION,
  type LocalProfileDocument,
  type LocalProfileExportPayload,
  type LocalProfileImportPayload,
  type LocalServerRecord,
  type SaveLocalServerInput,
} from '../types/localProfile';

const FALLBACK_STORAGE_KEY = 'openclaw.localProfile.preview';

function nowIso() {
  return new Date().toISOString();
}

function createEmptyProfile(): LocalProfileDocument {
  const now = nowIso();
  return {
    version: LOCAL_PROFILE_VERSION,
    createdAt: now,
    updatedAt: now,
    servers: [],
  };
}

function createEmptyImportPreview(): ImportPreviewResult {
  return {
    totalCount: 0,
    newCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    duplicates: [],
  };
}

function getBridge() {
  return window.openclawDesktop?.profile;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readFallbackProfile(): LocalProfileDocument {
  if (!canUseLocalStorage()) {
    return createEmptyProfile();
  }

  const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
  if (!raw) {
    return createEmptyProfile();
  }

  try {
    const parsed = JSON.parse(raw) as LocalProfileDocument;
    return {
      ...createEmptyProfile(),
      ...parsed,
      servers: Array.isArray(parsed.servers) ? parsed.servers : [],
    };
  } catch {
    window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
    return createEmptyProfile();
  }
}

function writeFallbackProfile(profile: LocalProfileDocument) {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(profile));
}

function normalizeDefault(servers: LocalServerRecord[]) {
  if (servers.length === 0) {
    return [];
  }

  const defaultId = servers.find((server) => server.isDefault)?.id ?? servers[0]?.id;
  return servers.map((server) => ({ ...server, isDefault: server.id === defaultId }));
}

export async function loadLocalProfile() {
  const bridge = getBridge();
  if (bridge) {
    return bridge.load();
  }

  return readFallbackProfile();
}

export async function saveLocalServer(input: SaveLocalServerInput) {
  const bridge = getBridge();
  if (bridge) {
    return bridge.save(input);
  }

  const current = readFallbackProfile();
  const existing = input.id ? current.servers.find((server) => server.id === input.id) : undefined;
  const now = nowIso();
  const nextRecord: LocalServerRecord = {
    id: existing?.id ?? crypto.randomUUID(),
    name: input.name?.trim() || input.serverIp || '未命名服务器',
    remark: input.remark ?? existing?.remark ?? '',
    serverIp: input.serverIp ?? existing?.serverIp ?? '',
    sshPort: input.sshPort ?? existing?.sshPort ?? 22,
    sshUsername: input.sshUsername ?? existing?.sshUsername ?? 'root',
    authType: input.authType ?? existing?.authType ?? 'password',
    sshPassword: input.sshPassword ?? existing?.sshPassword ?? '',
    sshPrivateKey: input.sshPrivateKey ?? existing?.sshPrivateKey ?? '',
    openclawToken: input.openclawToken ?? existing?.openclawToken ?? '',
    isDefault: input.isDefault ?? existing?.isDefault ?? current.servers.length === 0,
    lastConnectedAt: existing?.lastConnectedAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextServers = existing
    ? current.servers.map((server) => (server.id === existing.id ? nextRecord : server))
    : [...current.servers, nextRecord];

  const profile: LocalProfileDocument = {
    ...current,
    updatedAt: now,
    servers: normalizeDefault(nextServers),
  };
  writeFallbackProfile(profile);
  return profile;
}

export async function deleteLocalServer(id: string) {
  const bridge = getBridge();
  if (bridge) {
    return bridge.deleteServer(id);
  }

  const current = readFallbackProfile();
  const profile: LocalProfileDocument = {
    ...current,
    updatedAt: nowIso(),
    servers: normalizeDefault(current.servers.filter((server) => server.id !== id)),
  };
  writeFallbackProfile(profile);
  return profile;
}

export async function setDefaultLocalServer(id: string) {
  const bridge = getBridge();
  if (bridge) {
    return bridge.setDefault(id);
  }

  const current = readFallbackProfile();
  const profile: LocalProfileDocument = {
    ...current,
    updatedAt: nowIso(),
    servers: current.servers.map((server) => ({ ...server, isDefault: server.id === id })),
  };
  writeFallbackProfile(profile);
  return profile;
}

export async function markLocalServerConnected(id: string) {
  const bridge = getBridge();
  if (bridge) {
    return bridge.markConnected(id);
  }

  const current = readFallbackProfile();
  const connectedAt = nowIso();
  const profile: LocalProfileDocument = {
    ...current,
    updatedAt: connectedAt,
    servers: current.servers.map((server) =>
      server.id === id
        ? { ...server, lastConnectedAt: connectedAt, updatedAt: connectedAt }
        : server,
    ),
  };
  writeFallbackProfile(profile);
  return profile;
}

export async function importLocalServers(payload: LocalProfileImportPayload) {
  const bridge = getBridge();
  if (bridge) {
    return bridge.importData(payload);
  }

  const current = readFallbackProfile();
  const base = payload.mode === 'replace' ? [] : [...current.servers];
  const seenIds = new Set(base.map((server) => server.id));
  const imported = payload.servers.map((server) => {
    let nextId = server.id ?? crypto.randomUUID();
    while (seenIds.has(nextId)) {
      nextId = crypto.randomUUID();
    }
    seenIds.add(nextId);
    return {
      ...(server as LocalServerRecord),
      id: nextId,
      name: server.name?.trim() || server.serverIp || '导入服务器',
      remark: server.remark ?? '',
      createdAt: 'createdAt' in server && server.createdAt ? server.createdAt : nowIso(),
      updatedAt: nowIso(),
      lastConnectedAt: 'lastConnectedAt' in server ? server.lastConnectedAt : null,
      isDefault: Boolean('isDefault' in server && server.isDefault),
    } as LocalServerRecord;
  });
  const profile: LocalProfileDocument = {
    version: LOCAL_PROFILE_VERSION,
    createdAt: payload.mode === 'replace' ? nowIso() : current.createdAt,
    updatedAt: nowIso(),
    servers: normalizeDefault([...base, ...imported]),
  };
  writeFallbackProfile(profile);
  return profile;
}

export async function exportLocalServers(): Promise<LocalProfileExportPayload> {
  const bridge = getBridge();
  if (bridge) {
    return bridge.exportData();
  }

  const current = readFallbackProfile();
  return {
    version: current.version,
    exportedAt: nowIso(),
    servers: current.servers,
  };
}

export async function previewImportLocalServersFromDialog(backupPassword = ''): Promise<ImportPreviewResult> {
  const bridge = getBridge();
  if (bridge?.previewImport) {
    return bridge.previewImport(backupPassword);
  }

  return createEmptyImportPreview();
}

export async function importLocalServersFromDialog(backupPassword = ''): Promise<ImportFromDialogResult> {
  const bridge = getBridge();
  if (bridge) {
    return bridge.importFromDialog(backupPassword);
  }

  throw new Error('当前环境不支持原生导入窗口。');
}

export async function exportLocalServersToDialog(backupPassword: string): Promise<ExportToDialogResult> {
  const bridge = getBridge();
  if (bridge) {
    return bridge.exportToDialog(backupPassword);
  }

  throw new Error('当前环境不支持原生导出窗口。');
}
