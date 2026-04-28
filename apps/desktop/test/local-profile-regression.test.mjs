import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const localProfileTypePath = path.join(appRoot, 'src', 'types', 'localProfile.ts');
const configStorePath = path.join(appRoot, 'src', 'state', 'configStore.ts');
const localProfileCryptoPath = path.join(appRoot, 'src', 'lib', 'localProfileCrypto.ts');
const localProfileRepositoryPath = path.join(appRoot, 'src', 'lib', 'localProfileRepository.ts');
const localProfileServicePath = path.join(appRoot, 'src', 'lib', 'localProfileService.ts');
const preloadPath = path.join(appRoot, 'electron', 'preload.ts');
const mainPath = path.join(appRoot, 'electron', 'main.ts');
const ipcHandlersPath = path.join(appRoot, 'electron', 'ipc', 'localProfileHandlers.ts');

function exists(filePath) {
  return fs.existsSync(filePath);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('local profile type contract exists with multi-server metadata and encrypted sensitive fields', () => {
  assert.ok(exists(localProfileTypePath), 'Expected src/types/localProfile.ts to exist.');
  const source = read(localProfileTypePath);
  assert.match(source, /id:\s*string/);
  assert.match(source, /name:\s*string/);
  assert.match(source, /remark\??:\s*string/);
  assert.match(source, /isDefault:\s*boolean/);
  assert.match(source, /lastConnectedAt\??:\s*string/);
  assert.match(read(configStorePath), /openclawPort:\s*number/);
  assert.match(source, /encrypted/);
});

test('local profile crypto and repository layers exist for encrypted appdata persistence', () => {
  assert.ok(exists(localProfileCryptoPath), 'Expected src/lib/localProfileCrypto.ts to exist.');
  assert.ok(exists(localProfileRepositoryPath), 'Expected src/lib/localProfileRepository.ts to exist.');
  assert.ok(exists(localProfileServicePath), 'Expected src/lib/localProfileService.ts to exist.');
  assert.match(read(localProfileCryptoPath), /encrypt|decrypt/);
  assert.match(read(localProfileRepositoryPath), /APPDATA|appData|local-profile\.json/);
  assert.match(read(localProfileServicePath), /list|save|import|export/);
  assert.match(read(localProfileServicePath), /openclawPort/);
  assert.match(read(localProfileServicePath), /defaultServerConfigState\.openclawPort/);
});

test('backup crypto derives scrypt keys with an explicit memory budget for export and import', () => {
  const cryptoSource = read(localProfileCryptoPath);
  assert.match(cryptoSource, /scryptSync/);
  assert.match(cryptoSource, /maxmem\s*:/);
});

test('electron preload exposes local profile APIs to renderer without direct fs access', () => {
  const preloadSource = read(preloadPath);
  assert.match(preloadSource, /profile:/);
  assert.match(preloadSource, /load|list|save|import|export/);
});

test('electron main registers dedicated local profile IPC handlers', () => {
  assert.ok(exists(ipcHandlersPath), 'Expected electron/ipc/localProfileHandlers.ts to exist.');
  assert.match(read(mainPath), /registerLocalProfileHandlers/);
  assert.match(read(ipcHandlersPath), /ipcMain/);
  assert.match(read(ipcHandlersPath), /openclaw:profile:/);
});


test('local profile backup crypto supports password-based encrypted backup export and import', () => {
  const cryptoSource = read(localProfileCryptoPath);
  assert.match(cryptoSource, /encryptBackupPayload|decryptBackupPayload/);
  assert.match(cryptoSource, /scrypt/);
  assert.match(cryptoSource, /aes-256-gcm/);
});

test('electron import and export handlers require backup-password-aware encrypted file flow', () => {
  const ipcSource = read(ipcHandlersPath);
  assert.match(ipcSource, /backupPassword/);
  assert.match(ipcSource, /encrypted/);
  assert.match(ipcSource, /decryptBackupPayload|encryptBackupPayload/);
  assert.doesNotMatch(ipcSource, /JSON\.stringify\(payload, null, 2\)/);
});


