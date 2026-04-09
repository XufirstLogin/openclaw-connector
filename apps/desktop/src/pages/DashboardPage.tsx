import React from 'react';
import { ConnectionStatusCard } from '../components/ConnectionStatusCard';
import { Button, GlassCard } from '../components/ui';
import { ServerConfigState } from '../state/configStore';
import { ConnectionVisualState } from '../types/app';

type DashboardPageProps = {
  userEmail: string;
  config: ServerConfigState;
  status: ConnectionVisualState;
  notice?: string;
  onGoSettings: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onOpenGui: () => void;
  onLogout: () => void;
};

export function DashboardPage({
  userEmail,
  config,
  status,
  notice,
  onGoSettings,
  onConnect,
  onDisconnect,
  onOpenGui,
  onLogout,
}: DashboardPageProps) {
  return (
    <div className="app-page">
      <div className="dashboard-shell">
        <aside className="sidebar-card">
          <div>
            <span className="page-heading__eyebrow">账号</span>
            <h2 className="sidebar-card__title">{userEmail || '未登录用户'}</h2>
            <p className="sidebar-card__text">当前产品形态：Windows 桌面客户端 + 云端账号系统</p>
          </div>
          <div className="stack stack--compact">
            <Button variant="secondary" onClick={onGoSettings}>
              打开设置
            </Button>
            <Button variant="ghost" onClick={onLogout}>
              退出登录
            </Button>
          </div>
        </aside>

        <main className="dashboard-main">
          <div className="page-heading">
            <div>
              <span className="page-heading__eyebrow">控制台</span>
              <h1 className="page-heading__title">OpenClaw 连接面板</h1>
              <p className="page-heading__desc">点击连接后，本地将建立 127.0.0.1:18789 的 SSH 隧道，并自动打开 GUI Web。</p>
            </div>
          </div>

          {notice ? <div className="banner banner--info">{notice}</div> : null}

          <ConnectionStatusCard
            status={status}
            serverIp={config.serverIp || '未设置'}
            sshUsername={config.sshUsername || 'root'}
            authType={config.authType}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
            onOpenGui={onOpenGui}
          />

          <div className="stats-grid">
            <GlassCard title="公网服务器" subtitle="当前绑定的唯一服务器">
              <strong className="stat-value">{config.serverIp || '--'}</strong>
            </GlassCard>
            <GlassCard title="本地端口" subtitle="OpenClaw GUI 代理入口">
              <strong className="stat-value">127.0.0.1:18789</strong>
            </GlassCard>
            <GlassCard title="认证方式" subtitle="当前选中的 SSH 登录方式">
              <strong className="stat-value">{config.authType === 'password' ? '密码认证' : '私钥认证'}</strong>
            </GlassCard>
          </div>
        </main>
      </div>
    </div>
  );
}
