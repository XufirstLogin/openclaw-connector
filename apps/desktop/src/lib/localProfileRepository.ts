import fs from 'node:fs';
import path from 'node:path';
import { LOCAL_PROFILE_VERSION, type StoredLocalProfileDocument, type StoredLocalServerRecord } from '../types/localProfile';

export interface LocalProfileRepositoryOptions {
  appDataDir: string;
  productName?: string;
  profileFileName?: string;
  keyFileName?: string;
}

function nowIso() {
  return new Date().toISOString();
}

export function createEmptyStoredLocalProfile(): StoredLocalProfileDocument {
  const now = nowIso();
  return {
    version: LOCAL_PROFILE_VERSION,
    createdAt: now,
    updatedAt: now,
    servers: [],
  };
}

export class LocalProfileRepository {
  readonly storageDir: string;
  readonly profileFilePath: string;
  readonly keyFilePath: string;

  constructor(private readonly options: LocalProfileRepositoryOptions) {
    const productName = options.productName ?? 'OpenClaw Connector';
    // Persist under Windows %APPDATA% using Electron's appData path.
    this.storageDir = path.join(options.appDataDir, productName);
    this.profileFilePath = path.join(this.storageDir, options.profileFileName ?? 'local-profile.json');
    this.keyFilePath = path.join(this.storageDir, options.keyFileName ?? 'local-profile.key');
  }

  ensureStorageDir() {
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  load(): StoredLocalProfileDocument {
    this.ensureStorageDir();

    if (!fs.existsSync(this.profileFilePath)) {
      const empty = createEmptyStoredLocalProfile();
      this.save(empty);
      return empty;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.profileFilePath, 'utf8')) as Partial<StoredLocalProfileDocument>;
      return this.normalize(parsed);
    } catch {
      const empty = createEmptyStoredLocalProfile();
      this.save(empty);
      return empty;
    }
  }

  save(document: StoredLocalProfileDocument) {
    this.ensureStorageDir();
    const normalized = this.normalize(document);
    const tmpPath = this.profileFilePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.profileFilePath);
    return normalized;
  }

  private normalize(document: Partial<StoredLocalProfileDocument> | null | undefined): StoredLocalProfileDocument {
    const empty = createEmptyStoredLocalProfile();
    return {
      version: LOCAL_PROFILE_VERSION,
      createdAt: typeof document?.createdAt === 'string' ? document.createdAt : empty.createdAt,
      updatedAt: typeof document?.updatedAt === 'string' ? document.updatedAt : empty.updatedAt,
      servers: Array.isArray(document?.servers) ? (document.servers.filter(Boolean) as StoredLocalServerRecord[]) : [],
    };
  }
}
