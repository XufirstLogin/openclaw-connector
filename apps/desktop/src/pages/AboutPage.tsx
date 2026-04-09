import React from 'react';
import { Button, GlassCard } from '../components/ui';
import type { AppMetadata } from '../types/bridge';

type AboutPageProps = {
  version: string;
  metadata?: AppMetadata | null;
  autostartEnabled: boolean;
  autostartLoading: boolean;
  onToggleAutostart: () => Promise<unknown>;
  onExportBackup: () => Promise<unknown>;
  embedded?: boolean;
};

export function AboutPage({
  version,
  metadata,
  autostartEnabled,
  autostartLoading,
  onToggleAutostart,
  onExportBackup,
  embedded = false,
}: AboutPageProps) {
  const productName = metadata?.productName ?? 'OpenClaw Connector';
  const runtimeMode = metadata?.runtimeMode ?? '本地模式';
  const platform = metadata?.platform ?? 'Windows';
  const storageDir = metadata?.storageDir ?? '当前设备本地目录';
  const logDir = metadata?.logDir ?? '当前设备日志目录';
  const copyrightOwner = metadata?.copyrightOwner ?? 'CSDN 作者';
  const authorName = metadata?.authorName ?? '小小许下士';
  const authorId = metadata?.authorId ?? 'weixin_46085234';
  const sourceNote = metadata?.sourceNote ?? '本软件部分设计与实现思路来源于 CSDN 作者“小小许下士（weixin_46085234）”。';

  const content = (
    <>
      <GlassCard title="版本信息" subtitle="Windows 本地桌面客户端当前运行信息">
        <div className="about-page__meta-list">
          <div className="about-page__meta-row"><span>软件名称</span><strong>{productName}</strong></div>
          <div className="about-page__meta-row"><span>当前版本</span><strong>{metadata?.version ?? version}</strong></div>
          <div className="about-page__meta-row"><span>运行模式</span><strong>{runtimeMode}</strong></div>
          <div className="about-page__meta-row"><span>支持平台</span><strong>{platform}</strong></div>
        </div>
      </GlassCard>

      <GlassCard title="本地数据" subtitle="用于保存配置、日志与加密备份的本地目录">
        <div className="about-page__meta-list">
          <div className="about-page__meta-row"><span>数据目录</span><strong>{storageDir}</strong></div>
          <div className="about-page__meta-row"><span>日志目录</span><strong>{logDir}</strong></div>
        </div>
        <ul className="about-page__list">
          <li>服务器资料默认保存在当前 Windows 用户目录下。</li>
          <li>导出的备份文件会经过加密处理，适合迁移到其它设备。</li>
          <li>诊断页可查看连接日志，便于排查连接失败原因。</li>
        </ul>
        {!embedded ? (
          <div className="panel-actions panel-actions--row">
            <Button type="button" variant="secondary" onClick={() => { void onExportBackup(); }}>导出备份</Button>
          </div>
        ) : null}
      </GlassCard>

      <GlassCard title="版权说明" subtitle="版权归属与作品来源说明">
        <div className="about-page__meta-list">
          <div className="about-page__meta-row"><span>版权归属</span><strong>{copyrightOwner}</strong></div>
          <div className="about-page__meta-row"><span>作者名称</span><strong>{authorName}</strong></div>
          <div className="about-page__meta-row"><span>作者 ID</span><strong>{authorId}</strong></div>
        </div>
        <div className="about-page__source-note">
          <strong>作品来源说明</strong>
          <p>{sourceNote}</p>
        </div>
      </GlassCard>

      <GlassCard title="启动项" subtitle="是否随系统启动自动运行 SSH 隧道客户端">
        <div className="about-page__meta-row about-page__setting-row">
          <div className="about-page__setting-copy">
            <span>开机自动启动</span>
            <strong>{autostartEnabled ? '已开启' : '已关闭'}</strong>
          </div>
          <Button
            type="button"
            variant={autostartEnabled ? 'secondary' : 'primary'}
            disabled={autostartLoading}
            onClick={() => { void onToggleAutostart(); }}
          >
            {autostartLoading ? '处理中...' : autostartEnabled ? '关闭自启动' : '开启自启动'}
          </Button>
        </div>
      </GlassCard>
    </>
  );

  if (embedded) {
    return <div className="about-page__embedded">{content}</div>;
  }

  return <div className="about-page">{content}</div>;
}
