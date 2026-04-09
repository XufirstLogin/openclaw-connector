import React from 'react';
import type { ImportPreviewResult } from '../types/bridge';
import { Button, GlassCard } from './ui';

type ImportPreviewDialogProps = {
  open: boolean;
  preview: ImportPreviewResult | null;
  importing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ImportPreviewDialog({ open, preview, importing, onCancel, onConfirm }: ImportPreviewDialogProps) {
  if (!open || !preview) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div className="import-preview-dialog" role="dialog" aria-modal="true" aria-label="导入预览" onClick={(event) => event.stopPropagation()}>
        <GlassCard title="导入预览" subtitle="导入前先检查新增、重复和跳过的数据。">
          <div className="import-preview-dialog__stats">
            <div className="import-preview-dialog__stat"><strong>{preview.totalCount}</strong><span>总数</span></div>
            <div className="import-preview-dialog__stat"><strong>{preview.newCount}</strong><span>新增</span></div>
            <div className="import-preview-dialog__stat"><strong>{preview.duplicateCount}</strong><span>重复</span></div>
            <div className="import-preview-dialog__stat"><strong>{preview.skippedCount}</strong><span>跳过</span></div>
          </div>

          {preview.duplicates.length > 0 ? (
            <div className="import-preview-dialog__duplicate-list">
              {preview.duplicates.map((item, index) => (
                <div key={`${item.serverIp}-${item.sshUsername}-${index}`} className="import-preview-dialog__duplicate-item">
                  <strong>{item.name}</strong>
                  <span>{item.serverIp} · {item.sshUsername}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="glass-card__subtitle">未发现重复服务器，可以直接继续导入。</p>
          )}

          <div className="import-preview-dialog__actions">
            <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
            <Button type="button" onClick={onConfirm} disabled={importing}>{importing ? '导入中...' : '继续导入'}</Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
