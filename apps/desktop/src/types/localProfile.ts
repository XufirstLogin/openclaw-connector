import type { ServerConfigState } from '../state/configStore';

export const LOCAL_PROFILE_VERSION = 1 as const;
export type LocalProfileVersion = typeof LOCAL_PROFILE_VERSION;
export const LOCAL_BACKUP_VERSION = 1 as const;
export type LocalBackupVersion = typeof LOCAL_BACKUP_VERSION;

export interface EncryptedField {
  encrypted: true;
  algorithm: 'aes-256-gcm';
  iv: string;
  tag: string;
  value: string;
}

export interface LocalServerEditableFields extends ServerConfigState {
  name: string;
  remark: string;
}

export interface LocalServerRecord extends LocalServerEditableFields {
  id: string;
  isDefault: boolean;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredLocalServerRecord extends Omit<LocalServerRecord, 'sshPassword' | 'sshPrivateKey' | 'openclawToken'> {
  sshPassword: EncryptedField | null;
  sshPrivateKey: EncryptedField | null;
  openclawToken: EncryptedField;
}

export interface LocalProfileDocument {
  version: LocalProfileVersion;
  createdAt: string;
  updatedAt: string;
  servers: LocalServerRecord[];
}

export interface StoredLocalProfileDocument {
  version: LocalProfileVersion;
  createdAt: string;
  updatedAt: string;
  servers: StoredLocalServerRecord[];
}

export interface SaveLocalServerInput extends Partial<LocalServerEditableFields> {
  id?: string;
  name: string;
  remark?: string;
  isDefault?: boolean;
}

export interface LocalProfileImportPayload {
  servers: Array<SaveLocalServerInput | LocalServerRecord>;
  mode?: 'append' | 'replace';
}

export interface LocalProfileExportPayload {
  version: LocalProfileVersion;
  exportedAt: string;
  servers: LocalServerRecord[];
}

export interface LocalProfileEncryptedBackup {
  format: 'openclaw-backup';
  backupVersion: LocalBackupVersion;
  encrypted: true;
  algorithm: 'aes-256-gcm';
  kdf: 'scrypt';
  exportedAt: string;
  salt: string;
  iv: string;
  tag: string;
  payload: string;
}
