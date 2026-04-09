import React from 'react';
import type { DiagnosticsLogEntry } from '../types/bridge';
import { Button, GlassCard } from '../components/ui';

type DiagnosticsPageProps = {
  entries: DiagnosticsLogEntry[];
  loading?: boolean;
  onBack: () => void;
  onRefresh: () => Promise<void>;
  onCopy: () => Promise<void>;
  onClear: () => Promise<void>;
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function DiagnosticsPage({ entries, loading, onBack, onRefresh, onCopy, onClear }: DiagnosticsPageProps) {
  return (
    <div className="app-page diagnostics-page">
      <div className="page-heading diagnostics-page__heading">
        <div>
          <span className="page-heading__eyebrow">连接诊断</span>
          <h1 className="page-heading__title">连接日志与运行诊断</h1>
          <p className="page-heading__desc">这里会记录连接、断开、健康检查和自动重连等关键事件。</p>
        </div>
        <div className="panel-actions panel-actions--row">
          <Button type="button" variant="secondary" onClick={() => { void onRefresh(); }}>刷新</Button>
          <Button type="button" variant="secondary" onClick={() => { void onCopy(); }}>复制</Button>
          <Button type="button" variant="ghost" onClick={() => { void onClear(); }}>清空</Button>
          <Button type="button" variant="ghost" onClick={onBack}>返回主页</Button>
        </div>
      </div>

      <GlassCard title="最近连接日志" subtitle={loading ? '正在加载诊断数据…' : `共 ${entries.length} 条日志`}>
        {entries.length === 0 ? (
          <div className="diagnostics-empty-state">
            <strong>暂无诊断记录</strong>
            <p>建立连接、断开连接或自动重连后，这里会显示详细日志。</p>
          </div>
        ) : (
          <div className="diagnostics-log-list">
            {entries.map((entry) => (
              <article key={entry.id} className={`diagnostics-log-item diagnostics-log-item--${entry.level}`}>
                <div className="diagnostics-log-item__meta">
                  <strong>{entry.event}</strong>
                  <span>{formatTimestamp(entry.timestamp)}</span>
                </div>
                <p>{entry.message}</p>
                {entry.serverName || entry.serverId ? (
                  <span className="diagnostics-log-item__server">{entry.serverName || entry.serverId}</span>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
