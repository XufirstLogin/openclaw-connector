import { randomUUID } from 'node:crypto';
import { defaultServerConfigState } from '../state/configStore';
import {
  LOCAL_PROFILE_VERSION,
  type LocalProfileDocument,
  type LocalProfileExportPayload,
  type LocalProfileImportPayload,
  type LocalServerEditableFields,
  type LocalServerRecord,
  type SaveLocalServerInput,
  type StoredLocalProfileDocument,
  type StoredLocalServerRecord,
} from '../types/localProfile';
import { LocalProfileCrypto } from './localProfileCrypto';
import { LocalProfileRepository } from './localProfileRepository';

function nowIso() {
  return new Date().toISOString();
}

function cloneServer(server: LocalServerRecord): LocalServerRecord {
  return { ...server };
}

function buildEditableFields(input: Partial<LocalServerEditableFields>, fallback?: LocalServerRecord): LocalServerEditableFields {
  return {
    name: input.name ?? fallback?.name ?? '',
    remark: input.remark ?? fallback?.remark ?? '',
    serverIp: input.serverIp ?? fallback?.serverIp ?? defaultServerConfigState.serverIp,
    sshPort: input.sshPort ?? fallback?.sshPort ?? defaultServerConfigState.sshPort,
    sshUsername: input.sshUsername ?? fallback?.sshUsername ?? defaultServerConfigState.sshUsername,
    openclawPort: input.openclawPort ?? fallback?.openclawPort ?? defaultServerConfigState.openclawPort,
    authType: input.authType ?? fallback?.authType ?? defaultServerConfigState.authType,
    sshPassword: input.sshPassword ?? fallback?.sshPassword ?? '',
    sshPrivateKey: input.sshPrivateKey ?? fallback?.sshPrivateKey ?? '',
    openclawToken: input.openclawToken ?? fallback?.openclawToken ?? '',
  };
}

export class LocalProfileService {
  constructor(
    private readonly repository: LocalProfileRepository,
    private readonly crypto: LocalProfileCrypto,
  ) {}

  load(): LocalProfileDocument {
    return this.toPublicDocument(this.repository.load());
  }

  list() {
    return this.load().servers.map(cloneServer);
  }

  save(input: SaveLocalServerInput): LocalProfileDocument {
    const current = this.load();
    const existing = input.id ? current.servers.find((server) => server.id === input.id) : undefined;
    const editable = buildEditableFields(input, existing);
    const now = nowIso();

    const record: LocalServerRecord = {
      id: existing?.id ?? randomUUID(),
      name: editable.name.trim() || editable.serverIp || '未命名服务器',
      remark: editable.remark ?? '',
      serverIp: editable.serverIp,
      sshPort: editable.sshPort,
      sshUsername: editable.sshUsername,
      openclawPort: editable.openclawPort,
      authType: editable.authType,
      sshPassword: editable.sshPassword,
      sshPrivateKey: editable.sshPrivateKey,
      openclawToken: editable.openclawToken,
      isDefault: input.isDefault ?? existing?.isDefault ?? current.servers.length === 0,
      lastConnectedAt: existing?.lastConnectedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const nextServers = existing
      ? current.servers.map((server) => (server.id === existing.id ? record : server))
      : [...current.servers, record];

    return this.persist(current.createdAt, this.ensureSingleDefault(nextServers, record.isDefault ? record.id : undefined));
  }

  delete(id: string): LocalProfileDocument {
    const current = this.load();
    const nextServers = current.servers.filter((server) => server.id !== id);
    return this.persist(current.createdAt, this.ensureSingleDefault(nextServers));
  }

  setDefault(id: string): LocalProfileDocument {
    const current = this.load();
    return this.persist(current.createdAt, this.ensureSingleDefault(current.servers, id));
  }

  markConnected(id: string): LocalProfileDocument {
    const current = this.load();
    const connectedAt = nowIso();
    const nextServers = current.servers.map((server) =>
      server.id === id
        ? {
            ...server,
            lastConnectedAt: connectedAt,
            updatedAt: connectedAt,
          }
        : server,
    );

    return this.persist(current.createdAt, nextServers);
  }

  importData(payload: LocalProfileImportPayload): LocalProfileDocument {
    const current = this.load();
    const mode = payload.mode ?? 'append';
    const baseServers = mode === 'replace' ? [] : current.servers.map(cloneServer);
    const importedServers = payload.servers.map((server) => this.toImportedRecord(server, baseServers));
    const nextServers = [...baseServers, ...importedServers];
    return this.persist(mode === 'replace' ? nowIso() : current.createdAt, this.ensureSingleDefault(nextServers));
  }

  exportData(): LocalProfileExportPayload {
    const current = this.load();
    return {
      version: LOCAL_PROFILE_VERSION,
      exportedAt: nowIso(),
      servers: current.servers.map(cloneServer),
    };
  }

  private toImportedRecord(source: SaveLocalServerInput | LocalServerRecord, existingServers: LocalServerRecord[]) {
    const editable = buildEditableFields(source, 'createdAt' in source ? source : undefined);
    const now = nowIso();
    return {
      id: this.resolveImportedId(existingServers, source.id),
      name: editable.name.trim() || editable.serverIp || '导入服务器',
      remark: editable.remark ?? '',
      serverIp: editable.serverIp,
      sshPort: editable.sshPort,
      sshUsername: editable.sshUsername,
      openclawPort: editable.openclawPort,
      authType: editable.authType,
      sshPassword: editable.sshPassword,
      sshPrivateKey: editable.sshPrivateKey,
      openclawToken: editable.openclawToken,
      isDefault: Boolean('isDefault' in source && source.isDefault),
      lastConnectedAt: 'lastConnectedAt' in source ? source.lastConnectedAt : null,
      createdAt: 'createdAt' in source ? source.createdAt : now,
      updatedAt: now,
    } satisfies LocalServerRecord;
  }

  private resolveImportedId(existingServers: LocalServerRecord[], requestedId?: string) {
    if (requestedId && !existingServers.some((server) => server.id === requestedId)) {
      return requestedId;
    }

    let nextId = randomUUID();
    while (existingServers.some((server) => server.id === nextId)) {
      nextId = randomUUID();
    }
    return nextId;
  }

  private ensureSingleDefault(servers: LocalServerRecord[], preferredId?: string) {
    if (servers.length === 0) {
      return [];
    }

    const defaultId = preferredId
      ?? servers.find((server) => server.isDefault)?.id
      ?? servers[0]?.id;

    return servers.map((server) => ({
      ...server,
      isDefault: server.id === defaultId,
    }));
  }

  private persist(createdAt: string, servers: LocalServerRecord[]) {
    const document: LocalProfileDocument = {
      version: LOCAL_PROFILE_VERSION,
      createdAt,
      updatedAt: nowIso(),
      servers: servers.map(cloneServer),
    };

    this.repository.save(this.toStoredDocument(document));
    return this.load();
  }

  private toStoredDocument(document: LocalProfileDocument): StoredLocalProfileDocument {
    return {
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      servers: document.servers.map((server) => this.toStoredServer(server)),
    };
  }

  private toStoredServer(server: LocalServerRecord): StoredLocalServerRecord {
    return {
      id: server.id,
      name: server.name,
      remark: server.remark,
      serverIp: server.serverIp,
      sshPort: server.sshPort,
      sshUsername: server.sshUsername,
      openclawPort: server.openclawPort ?? defaultServerConfigState.openclawPort,
      authType: server.authType,
      sshPassword: this.crypto.encryptOptional(server.sshPassword),
      sshPrivateKey: this.crypto.encryptOptional(server.sshPrivateKey),
      openclawToken: this.crypto.encrypt(server.openclawToken),
      isDefault: server.isDefault,
      lastConnectedAt: server.lastConnectedAt,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  }

  private toPublicDocument(document: StoredLocalProfileDocument): LocalProfileDocument {
    return {
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      servers: document.servers.map((server) => this.toPublicServer(server)),
    };
  }

  private toPublicServer(server: StoredLocalServerRecord): LocalServerRecord {
    return {
      id: server.id,
      name: server.name,
      remark: server.remark,
      serverIp: server.serverIp,
      sshPort: server.sshPort,
      sshUsername: server.sshUsername,
      openclawPort: server.openclawPort ?? defaultServerConfigState.openclawPort,
      authType: server.authType,
      sshPassword: this.crypto.decryptOptional(server.sshPassword),
      sshPrivateKey: this.crypto.decryptOptional(server.sshPrivateKey),
      openclawToken: this.crypto.decrypt(server.openclawToken),
      isDefault: server.isDefault,
      lastConnectedAt: server.lastConnectedAt,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
    };
  }
}


