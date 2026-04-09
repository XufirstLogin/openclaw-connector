import net from 'node:net';
import { createRequire } from 'node:module';
import { TunnelConnectRequest, TunnelConnectResult, TunnelStateSnapshot } from '../../../src/types/bridge';
import { TunnelAdapter, TunnelAdapterAssessment } from './TunnelAdapter';
import { buildLocalGuiUrl, buildSshCommandPreview } from '../utils';

const runtimeRequire = createRequire(__filename);

function loadSsh2Module(): any | null {
  try {
    return runtimeRequire('ssh2');
  } catch {
    return null;
  }
}

function closeSocket(socket: net.Socket) {
  try {
    socket.destroy();
  } catch {
    // ignore cleanup errors
  }
}

export class Ssh2TunnelAdapter implements TunnelAdapter {
  readonly kind = 'ssh2' as const;
  private snapshot: Partial<TunnelStateSnapshot> = {};
  private client: any | null = null;
  private server: net.Server | null = null;
  private sockets = new Set<net.Socket>();
  private remoteStreams = new Set<any>();
  private disconnectRequested = false;

  assess(config: TunnelConnectRequest): TunnelAdapterAssessment {
    const ssh2 = loadSsh2Module();
    if (!ssh2?.Client) {
      return {
        supported: false,
        priority: 40,
        reason: 'ssh2 package is not installed yet. Install it to enable password/key tunnel backend.',
      };
    }

    if (config.authType === 'password' && !config.sshPassword) {
      return { supported: false, priority: 40, reason: 'Password auth selected but no password provided.' };
    }

    if (config.authType === 'key' && !config.sshPrivateKey) {
      return { supported: false, priority: 40, reason: 'Key auth selected but no private key provided.' };
    }

    return {
      supported: true,
      priority: config.authType === 'password' ? 80 : 60,
      reason: config.authType === 'password'
        ? 'ssh2 password tunnel backend is available.'
        : 'ssh2 key-based tunnel backend is available.',
    };
  }

  async connect(config: TunnelConnectRequest): Promise<TunnelConnectResult> {
    const ssh2 = loadSsh2Module();
    const commandPreview = buildSshCommandPreview(config);
    const localUrl = buildLocalGuiUrl(config.openclawToken);

    if (!ssh2?.Client) {
      this.snapshot = {
        status: 'error',
        adapterKind: this.kind,
        mode: 'skeleton',
        localUrl,
        commandPreview,
        reason: 'ssh2 package missing. Install dependency to enable this backend.',
      };
      return {
        connected: false,
        mode: 'skeleton',
        localUrl,
        commandPreview,
        reason: this.snapshot.reason,
      };
    }

    await this.disconnect();
    this.disconnectRequested = false;

    const client = new ssh2.Client();
    this.client = client;

    const connectionOptions: Record<string, unknown> = {
      host: config.serverIp,
      port: config.sshPort || 22,
      username: config.sshUsername,
      keepaliveInterval: 30_000,
      keepaliveCountMax: 3,
      readyTimeout: 15_000,
    };

    if (config.authType === 'password') {
      connectionOptions.password = config.sshPassword;
    } else {
      connectionOptions.privateKey = config.sshPrivateKey;
    }

    return new Promise<TunnelConnectResult>((resolve) => {
      let settled = false;

      const finish = (result: TunnelConnectResult, snapshot?: Partial<TunnelStateSnapshot>) => {
        if (settled) return;
        settled = true;
        if (snapshot) {
          this.snapshot = snapshot;
        }
        resolve(result);
      };

      client.on('ready', () => {
        const server = net.createServer((localSocket) => {
          this.sockets.add(localSocket);
          const srcAddr = localSocket.localAddress || '127.0.0.1';
          const srcPort = localSocket.localPort || 0;

          client.forwardOut(srcAddr, srcPort, '127.0.0.1', 18789, (error: Error | undefined, stream: any) => {
            if (error || !stream) {
              localSocket.destroy(error);
              return;
            }

            this.remoteStreams.add(stream);
            localSocket.pipe(stream);
            stream.pipe(localSocket);

            const cleanup = () => {
              this.remoteStreams.delete(stream);
              this.sockets.delete(localSocket);
            };

            localSocket.on('close', cleanup);
            localSocket.on('error', cleanup);
            stream.on('close', cleanup);
            stream.on('error', cleanup);
          });
        });

        this.server = server;

        server.once('error', async (error) => {
          await this.disconnect();
          finish(
            {
              connected: false,
              mode: 'ipc',
              localUrl,
              commandPreview,
              reason: `本地监听失败: ${error.message}`,
            },
            {
              status: 'error',
              adapterKind: this.kind,
              mode: 'ipc',
              localUrl,
              commandPreview,
              reason: `本地监听失败: ${error.message}`,
            },
          );
        });

        server.listen(18789, '127.0.0.1', () => {
          finish(
            {
              connected: true,
              mode: 'ipc',
              localUrl,
              commandPreview,
              reason: `ssh2 tunnel active on 127.0.0.1:18789 -> ${config.serverIp}:127.0.0.1:18789`,
            },
            {
              status: 'connected',
              adapterKind: this.kind,
              mode: 'ipc',
              localUrl,
              commandPreview,
              reason: `ssh2 tunnel active on 127.0.0.1:18789 -> ${config.serverIp}:127.0.0.1:18789`,
            },
          );
        });
      });

      client.on('error', (error: Error) => {
        finish(
          {
            connected: false,
            mode: 'ipc',
            localUrl,
            commandPreview,
            reason: error.message,
          },
          {
            status: 'error',
            adapterKind: this.kind,
            mode: 'ipc',
            localUrl,
            commandPreview,
            reason: error.message,
          },
        );
      });

      client.on('close', () => {
        if (this.disconnectRequested) {
          this.snapshot = {
            status: 'disconnected',
            adapterKind: this.kind,
            mode: 'ipc',
          };
          return;
        }

        this.snapshot = {
          status: 'error',
          adapterKind: this.kind,
          mode: 'ipc',
          localUrl,
          commandPreview,
          reason: 'ssh2 connection closed unexpectedly.',
        };
      });

      client.connect(connectionOptions as any);
    });
  }

  async disconnect(): Promise<void> {
    this.disconnectRequested = true;

    for (const socket of this.sockets) {
      closeSocket(socket);
    }
    this.sockets.clear();

    for (const stream of this.remoteStreams) {
      try {
        stream.end?.();
        stream.close?.();
      } catch {
        // ignore cleanup errors
      }
    }
    this.remoteStreams.clear();

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      }).catch(() => undefined);
      this.server = null;
    }

    if (this.client) {
      try {
        this.client.end();
      } catch {
        // ignore cleanup errors
      }
      this.client = null;
    }

    this.snapshot = {
      status: 'disconnected',
      adapterKind: this.kind,
      mode: 'ipc',
    };
  }

  getSnapshot(): Partial<TunnelStateSnapshot> {
    return { ...this.snapshot, adapterKind: this.kind, mode: this.snapshot.mode ?? 'ipc' };
  }
}
