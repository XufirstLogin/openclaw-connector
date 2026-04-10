import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { TunnelConnectRequest, TunnelConnectResult, TunnelStateSnapshot } from '../../../src/types/bridge';
import { TunnelAdapter, TunnelAdapterAssessment } from './TunnelAdapter';
import { buildLocalGuiUrl, buildSshCommandArgs, buildSshCommandPreview, detectSystemSshPath } from '../utils';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeUnlink(filePath?: string | null) {
  if (!filePath || !existsSync(filePath)) {
    return;
  }

  try {
    await unlink(filePath);
  } catch {
    // best-effort cleanup only
  }
}

async function killWindowsProcessTree(pid: number) {
  await new Promise<void>((resolve) => {
    const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });

    killer.once('exit', () => resolve());
    killer.once('error', () => resolve());
  });
}

export class CommandSshTunnelAdapter implements TunnelAdapter {
  readonly kind = 'ssh-command' as const;
  private snapshot: Partial<TunnelStateSnapshot> = {};
  private sshPath = detectSystemSshPath();
  private childProcess: ReturnType<typeof spawn> | null = null;
  private tempKeyPath: string | null = null;
  private stderrBuffer: string[] = [];
  private readonly startupWaitMs = 1500;
  private currentConnectionId: symbol | null = null;

  assess(config: TunnelConnectRequest): TunnelAdapterAssessment {
    if (!this.sshPath) {
      return { supported: false, priority: 20, reason: 'System ssh executable not found.' };
    }

    if (config.authType === 'password') {
      return {
        supported: false,
        priority: 20,
        reason: 'System ssh.exe command mode cannot safely automate password entry for this product. Use ssh2 or another backend for password auth.',
      };
    }

    if (!config.sshPrivateKey) {
      return {
        supported: false,
        priority: 20,
        reason: 'Private key content is required for ssh command adapter.',
      };
    }

    return {
      supported: true,
      priority: 20,
      reason: 'Real key-based ssh.exe tunneling is available through a temporary private-key file.',
    };
  }

  async connect(config: TunnelConnectRequest): Promise<TunnelConnectResult> {
    if (!this.sshPath) {
      return {
        connected: false,
        mode: 'skeleton',
        reason: '未检测到系统 ssh.exe。',
      };
    }

    if (config.authType !== 'key' || !config.sshPrivateKey) {
      return {
        connected: false,
        mode: 'skeleton',
        reason: '当前真实 command adapter 仅支持私钥认证。',
      };
    }

    await this.disconnect();
    this.stderrBuffer = [];

    const connectionId = Symbol('cmd-ssh-conn');
    this.currentConnectionId = connectionId;

    const keyDir = path.join(os.tmpdir(), 'openclaw-connector', 'ssh-keys');
    await mkdir(keyDir, { recursive: true });

    this.tempKeyPath = path.join(keyDir, `${randomUUID()}.pem`);
    await writeFile(this.tempKeyPath, `${config.sshPrivateKey.trim()}${os.EOL}`, {
      encoding: 'utf8',
      mode: 0o600,
    });

    const args = buildSshCommandArgs(config, this.tempKeyPath);
    const commandPreview = buildSshCommandPreview(config, {
      includeKeyHint: true,
      sshPath: this.sshPath,
    });

    const localUrl = buildLocalGuiUrl(config.openclawToken);

    try {
      this.childProcess = spawn(this.sshPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      await safeUnlink(this.tempKeyPath);
      this.tempKeyPath = null;
      return {
        connected: false,
        mode: 'skeleton',
        commandPreview,
        reason: error instanceof Error ? error.message : 'ssh.exe 启动失败。',
      };
    }

    this.childProcess.stderr?.on('data', (chunk) => {
      this.stderrBuffer.push(String(chunk));
      this.stderrBuffer = this.stderrBuffer.slice(-8);
    });

    this.childProcess.stdout?.on('data', (chunk) => {
      const text = String(chunk).trim();
      if (text) {
        this.stderrBuffer.push(text);
        this.stderrBuffer = this.stderrBuffer.slice(-8);
      }
    });

    this.childProcess.once('exit', async () => {
      if (this.currentConnectionId !== connectionId) return;
      const lastReason = this.stderrBuffer.join('\n').trim() || 'ssh 进程已退出。';
      this.snapshot = {
        status: 'error',
        adapterKind: this.kind,
        mode: 'ipc',
        commandPreview,
        localUrl,
        reason: lastReason,
      };
      await safeUnlink(this.tempKeyPath);
      this.tempKeyPath = null;
      this.childProcess = null;
    });

    this.childProcess.once('error', async (error) => {
      if (this.currentConnectionId !== connectionId) return;
      this.snapshot = {
        status: 'error',
        adapterKind: this.kind,
        mode: 'ipc',
        commandPreview,
        localUrl,
        reason: error.message,
      };
      await safeUnlink(this.tempKeyPath);
      this.tempKeyPath = null;
      this.childProcess = null;
    });

    await wait(this.startupWaitMs);

    if (!this.childProcess || this.childProcess.killed || this.childProcess.exitCode !== null) {
      const reason = this.stderrBuffer.join('\n').trim() || 'ssh 隧道在启动阶段退出。';
      await safeUnlink(this.tempKeyPath);
      this.tempKeyPath = null;
      this.childProcess = null;
      this.snapshot = {
        status: 'error',
        adapterKind: this.kind,
        mode: 'ipc',
        commandPreview,
        localUrl,
        reason,
      };
      return {
        connected: false,
        mode: 'ipc',
        commandPreview,
        localUrl,
        reason,
      };
    }

    this.snapshot = {
      status: 'connected',
      adapterKind: this.kind,
      mode: 'ipc',
      commandPreview,
      localUrl,
      reason: `ssh.exe tunnel active (pid=${this.childProcess.pid ?? 'unknown'})`,
    };

    return {
      connected: true,
      mode: 'ipc',
      localUrl,
      commandPreview,
      reason: this.snapshot.reason,
    };
  }

  async disconnect(): Promise<void> {
    const child = this.childProcess;
    this.childProcess = null;

    if (child && child.pid) {
      await killWindowsProcessTree(child.pid);
    }

    await safeUnlink(this.tempKeyPath);
    this.tempKeyPath = null;
    this.stderrBuffer = [];
    this.snapshot = {
      status: 'disconnected',
      adapterKind: this.kind,
      mode: 'ipc',
    };
  }

  getSnapshot(): Partial<TunnelStateSnapshot> {
    return { ...this.snapshot, adapterKind: this.kind, mode: 'ipc' };
  }
}

