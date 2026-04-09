import React from 'react';
import { Button, GlassCard } from '../components/ui';
import type { AppMetadata } from '../types/bridge';

type SettingsPageProps = {
  version: string;
  metadata?: AppMetadata | null;
  autostartEnabled: boolean;
  autostartLoading: boolean;
  onToggleAutostart: () => Promise<unknown>;
  onBack: () => void;
  onOpenDiagnostics: () => void;
  onImportBackup: () => Promise<unknown>;
  onExportBackup: () => Promise<unknown>;
};

export function SettingsPage({
  version,
  metadata,
  autostartEnabled,
  autostartLoading,
  onToggleAutostart,
  onBack,
  onOpenDiagnostics,
  onImportBackup,
  onExportBackup,
}: SettingsPageProps) {
  const productName = metadata?.productName ?? 'OpenClaw Connector';
  const runtimeMode = metadata?.runtimeMode ?? '本地模式';
  const platform = metadata?.platform ?? 'Windows';
  const copyrightOwner = metadata?.copyrightOwner ?? 'CSDN 作者';
  const authorName = metadata?.authorName ?? '小小许下士';
  const authorId = metadata?.authorId ?? 'weixin_46085234';
  const sourceNote = metadata?.sourceNote ?? '本软件部分设计与实现思路来源于 CSDN 作者“小小许下士（weixin_46085234）”。';

  return (
    <div className="app-page settings-page">
      <div className="settings-page__container">
        <div className="page-heading settings-page__heading">
          <div>
            <span className="page-heading__eyebrow">设置</span>
            <h1 className="page-heading__title">设置中心</h1>
            <p className="page-heading__desc">管理开机启动、连接排查、备份恢复与版本信息。</p>
          </div>
          <div className="panel-actions panel-actions--row">
            <Button type="button" variant="secondary" onClick={() => { void onOpenDiagnostics(); }}>打开诊断</Button>
            <Button type="button" variant="ghost" onClick={onBack}>返回工作区</Button>
          </div>
        </div>

        <div className="settings-page__stack">
          <GlassCard title="通用设置" subtitle="适合正式客户使用的桌面端基础偏好">
            <div className="settings-page__item-row">
              <div>
                <strong>开机自动启动</strong>
                <p className="glass-card__subtitle">Windows 启动后自动运行客户端，便于持续保持 SSH 隧道能力。</p>
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

          <GlassCard title="连接设置" subtitle="连接 SSH 与 OpenClaw 前建议优先完成的检查">
            <ul className="about-page__list">
              <li>请确认服务器公网 IP、SSH 端口和用户名填写正确。</li>
              <li>请确认密码或私钥可用，且服务器已开启 SSH 服务。</li>
              <li>请确认安全组、防火墙和本地网络允许访问目标服务器。</li>
              <li>如仍无法连接，可前往诊断页查看详细连接日志。</li>
            </ul>
            <div className="panel-actions panel-actions--row">
              <Button type="button" variant="secondary" onClick={() => { void onOpenDiagnostics(); }}>查看诊断</Button>
            </div>
          </GlassCard>

          <GlassCard title="备份恢复" subtitle="支持加密导入与导出本地服务器资料">
            <div className="panel-actions panel-actions--row">
              <Button type="button" variant="secondary" onClick={() => { void onImportBackup(); }}>导入备份</Button>
              <Button type="button" onClick={() => { void onExportBackup(); }}>导出备份</Button>
            </div>
          </GlassCard>

          <GlassCard title="关于版本" subtitle="Windows 桌面客户端当前版本与版权信息">
            <div className="about-page__meta-list">
              <div className="about-page__meta-row"><span>软件名称</span><strong>{productName}</strong></div>
              <div className="about-page__meta-row"><span>当前版本</span><strong>{metadata?.version ?? version}</strong></div>
              <div className="about-page__meta-row"><span>运行模式</span><strong>{runtimeMode}</strong></div>
              <div className="about-page__meta-row"><span>支持平台</span><strong>{platform}</strong></div>
              <div className="about-page__meta-row"><span>版权归属</span><strong>{copyrightOwner}</strong></div>
              <div className="about-page__meta-row"><span>作者名称</span><strong>{authorName}</strong></div>
              <div className="about-page__meta-row"><span>作者 ID</span><strong>{authorId}</strong></div>
            </div>
            <div className="about-page__source-note about-page__source-note--subtle">
              <strong>作品来源说明</strong>
              <p>{sourceNote}</p>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
