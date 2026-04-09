import React from 'react';
import { Button } from './ui';

export type FeedbackToastKind = 'success' | 'error' | 'info';

export type FeedbackToastProps = {
  open: boolean;
  kind: FeedbackToastKind;
  title: string;
  message: string;
  onClose: () => void;
};

export function FeedbackToast({ open, kind, title, message, onClose }: FeedbackToastProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="toast-overlay" aria-live="polite">
      <div className={`feedback-toast feedback-toast--${kind}`}>
        <div className="feedback-toast__content">
          <strong className="feedback-toast__title">{title}</strong>
          <p className="feedback-toast__message">{message}</p>
        </div>
        <Button variant="ghost" className="feedback-toast__close" onClick={onClose}>关闭</Button>
      </div>
    </div>
  );
}
