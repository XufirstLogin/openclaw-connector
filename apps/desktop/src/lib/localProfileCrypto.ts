import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import type {
  EncryptedField,
  LocalProfileEncryptedBackup,
  LocalProfileExportPayload,
} from '../types/localProfile';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const BACKUP_SALT_LENGTH = 16;

function ensureLocalProfileKey(keyFilePath: string) {
  fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });

  if (fs.existsSync(keyFilePath)) {
    const raw = fs.readFileSync(keyFilePath, 'utf8').trim();
    if (raw) {
      const decoded = Buffer.from(raw, 'base64');
      if (decoded.length === KEY_LENGTH) {
        return decoded;
      }
    }
  }

  const key = randomBytes(KEY_LENGTH);
  fs.writeFileSync(keyFilePath, key.toString('base64'), 'utf8');
  return key;
}

function deriveBackupKey(password: string, salt: Buffer) {
  return scryptSync(password, salt, KEY_LENGTH);
}

export class LocalProfileCrypto {
  constructor(private readonly keyFilePath: string) {}

  private getKey() {
    return ensureLocalProfileKey(this.keyFilePath);
  }

  encrypt(value: string): EncryptedField {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encrypted: true,
      algorithm: ALGORITHM,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      value: encrypted.toString('base64'),
    };
  }

  encryptOptional(value: string | null | undefined) {
    if (!value) {
      return null;
    }

    return this.encrypt(value);
  }

  decrypt(payload: EncryptedField) {
    const decipher = createDecipheriv(ALGORITHM, this.getKey(), Buffer.from(payload.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.value, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  decryptOptional(payload: EncryptedField | null | undefined) {
    if (!payload) {
      return '';
    }

    return this.decrypt(payload);
  }

  encryptBackupPayload(payload: LocalProfileExportPayload, backupPassword: string): LocalProfileEncryptedBackup {
    if (!backupPassword) {
      throw new Error('请输入备份密码。');
    }

    const salt = randomBytes(BACKUP_SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = deriveBackupKey(backupPassword, salt);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      format: 'openclaw-backup',
      backupVersion: 1,
      encrypted: true,
      algorithm: ALGORITHM,
      kdf: 'scrypt',
      exportedAt: payload.exportedAt,
      salt: salt.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      payload: encrypted.toString('base64'),
    };
  }

  decryptBackupPayload(backup: LocalProfileEncryptedBackup, backupPassword: string): LocalProfileExportPayload {
    if (!backupPassword) {
      throw new Error('请输入备份密码。');
    }

    try {
      const key = deriveBackupKey(backupPassword, Buffer.from(backup.salt, 'base64'));
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(backup.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(backup.tag, 'base64'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(backup.payload, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      const parsed = JSON.parse(plaintext) as LocalProfileExportPayload;
      if (!Array.isArray(parsed?.servers)) {
        throw new Error('invalid backup payload');
      }
      return parsed;
    } catch {
      throw new Error('备份解密失败，请检查备份密码是否正确。');
    }
  }
}
