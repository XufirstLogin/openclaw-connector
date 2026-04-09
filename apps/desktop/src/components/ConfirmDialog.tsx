import React from 'react';
import { Button, GlassCard } from './ui';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认删除',
  cancelLabel = '取消',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <GlassCard title={title} subtitle={message}>
          <div className="panel-actions panel-actions--row confirm-dialog__actions">
            <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
