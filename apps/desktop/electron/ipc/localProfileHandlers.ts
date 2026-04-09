import fs from 'node:fs';
import path from 'node:path';
import type { BrowserWindow, Dialog, IpcMain } from 'electron';
import { LocalProfileCrypto } from '../../src/lib/localProfileCrypto';
import { LocalProfileService } from '../../src/lib/localProfileService';
import type { ImportPreviewItem, ImportPreviewResult } from '../../src/types/bridge';
import type {
  LocalProfileEncryptedBackup,
  LocalProfileExportPayload,
  LocalProfileImportPayload,
  LocalServerRecord,
  SaveLocalServerInput,
} from '../../src/types/localProfile';

let pendingImportPayload: LocalProfileExportPayload | null = null;

function buildImportBackupFilters() {
  return [
    { name: 'OpenClaw Backup', extensions: ['oclbackup', 'json'] },
    { name: 'All Files', extensions: ['*'] },
  ];
}

function buildExportBackupFilters() {
  return [
    { name: 'OpenClaw Backup', extensions: ['oclbackup'] },
    { name: 'All Files', extensions: ['*'] },
  ];
}

function isEncryptedBackup(value: unknown): value is LocalProfileEncryptedBackup {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LocalProfileEncryptedBackup>;
  return candidate.encrypted === true
    && candidate.format === 'openclaw-backup'
    && typeof candidate.payload === 'string'
    && typeof candidate.salt === 'string'
    && typeof candidate.iv === 'string'
    && typeof candidate.tag === 'string';
}

function isLegacyPlainBackup(value: unknown): value is LocalProfileExportPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LocalProfileExportPayload>;
  return Array.isArray(candidate.servers);
}

function createEmptyPreview(): ImportPreviewResult {
  return {
    totalCount: 0,
    newCount: 0,
    duplicateCount: 0,
    skippedCount: 0,
    duplicates: [],
  };
}

function normalizeServerIdentity(server: Pick<SaveLocalServerInput, 'serverIp' | 'sshPort' | 'sshUsername'>) {
  return `${server.serverIp ?? ''}::${server.sshPort ?? 22}::${server.sshUsername ?? ''}`.trim().toLowerCase();
}

function buildPreview(service: LocalProfileService, payload: LocalProfileExportPayload): ImportPreviewResult {
  const existingKeys = new Set(service.load().servers.map((server) => normalizeServerIdentity(server)));
  const duplicates: ImportPreviewItem[] = [];
  let newCount = 0;

  for (const server of payload.servers) {
    if (existingKeys.has(normalizeServerIdentity(server))) {
      duplicates.push({
        name: server.name?.trim() || server.serverIp || '??????',
        serverIp: server.serverIp ?? '',
        sshUsername: server.sshUsername ?? '',
      });
    } else {
      newCount += 1;
    }
  }

  return {
    totalCount: payload.servers.length,
    newCount,
    duplicateCount: duplicates.length,
    skippedCount: duplicates.length,
    duplicates,
  };
}

function filterAppendServers(service: LocalProfileService, payload: LocalProfileExportPayload) {
  const existingKeys = new Set(service.load().servers.map((server) => normalizeServerIdentity(server)));
  return payload.servers.filter((server) => !existingKeys.has(normalizeServerIdentity(server)));
}

function readBackupPayloadFromFile(filePath: string, crypto: LocalProfileCrypto, backupPassword: string) {
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(text) as unknown;

  const payload = isEncryptedBackup(parsed)
    ? crypto.decryptBackupPayload(parsed, backupPassword)
    : isLegacyPlainBackup(parsed)
      ? parsed
      : null;

  if (!payload || !Array.isArray(payload.servers)) {
    throw new Error('???????');
  }

  return payload;
}

async function chooseBackupFile(dialog: Dialog, getOwnerWindow: () => BrowserWindow | null) {
  const result = await dialog.showOpenDialog(getOwnerWindow() ?? undefined, {
    title: '?? OpenClaw ??',
    properties: ['openFile'],
    filters: buildImportBackupFilters(),
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

export function registerLocalProfileHandlers(
  ipcMain: IpcMain,
  service: LocalProfileService,
  crypto: LocalProfileCrypto,
  dialog: Dialog,
  getOwnerWindow: () => BrowserWindow | null,
) {
  ipcMain.handle('openclaw:profile:load', () => service.load());
  ipcMain.handle('openclaw:profile:list', () => service.list());
  ipcMain.handle('openclaw:profile:save', (_event, input: SaveLocalServerInput) => service.save(input));
  ipcMain.handle('openclaw:profile:delete', (_event, id: string) => service.delete(id));
  ipcMain.handle('openclaw:profile:set-default', (_event, id: string) => service.setDefault(id));
  ipcMain.handle('openclaw:profile:mark-connected', (_event, id: string) => service.markConnected(id));
  ipcMain.handle('openclaw:profile:import', (_event, payload: LocalProfileImportPayload) => service.importData(payload));
  ipcMain.handle('openclaw:profile:export', () => service.exportData());

  ipcMain.handle('openclaw:profile:preview-import', async (_event, backupPassword: string = '') => {
    const filePath = await chooseBackupFile(dialog, getOwnerWindow);
    if (!filePath) {
      pendingImportPayload = null;
      return createEmptyPreview();
    }

    const payload = readBackupPayloadFromFile(filePath, crypto, backupPassword);
    pendingImportPayload = payload;
    return buildPreview(service, payload);
  });

  ipcMain.handle('openclaw:profile:import-dialog', async (_event, backupPassword: string = '') => {
    const payload = pendingImportPayload ?? (() => {
      throw new Error('?????????????');
    })();

    const servers = filterAppendServers(service, payload as LocalProfileExportPayload);
    const profile = service.importData({
      mode: 'append',
      servers,
    });
    pendingImportPayload = null;

    return {
      canceled: false,
      profile,
      importedCount: servers.length,
    };
  });

  ipcMain.handle('openclaw:profile:export-dialog', async (_event, backupPassword: string) => {
    const payload = service.exportData();
    const encryptedBackup = crypto.encryptBackupPayload(payload, backupPassword);
    const defaultFileName = `openclaw-backup-${new Date().toISOString().slice(0, 10)}.oclbackup`;
    const result = await dialog.showSaveDialog(getOwnerWindow() ?? undefined, {
      title: '?? OpenClaw ??',
      defaultPath: path.join(process.env.USERPROFILE ?? process.cwd(), 'Desktop', defaultFileName),
      filters: buildExportBackupFilters(),
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(result.filePath, JSON.stringify(encryptedBackup, null, 2), 'utf8');
    return {
      canceled: false,
      filePath: result.filePath,
      exportedCount: payload.servers.length,
    };
  });
}
