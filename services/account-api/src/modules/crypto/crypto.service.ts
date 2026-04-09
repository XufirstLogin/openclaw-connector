import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { loadConfig } from '../../config/app.config';

@Injectable()
export class CryptoService {
  private readonly key = createHash('sha256')
    .update(loadConfig().appCryptoKey)
    .digest();

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivBase64, tagBase64, payloadBase64] = ciphertext.split('.');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivBase64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payloadBase64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}