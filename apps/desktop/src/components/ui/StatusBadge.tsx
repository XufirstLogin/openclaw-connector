import React from 'react';
import { ConnectionVisualState } from '../../types/app';

const LABELS: Record<ConnectionVisualState, string> = {
  disconnected: '未连接',
  connecting: '连接中',
  connected: '已连接',
  disconnecting: '断开中',
  error: '异常',
};

type StatusBadgeProps = {
  status: ConnectionVisualState;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status]}</span>;
}
