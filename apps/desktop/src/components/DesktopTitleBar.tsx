import React from 'react';
import { Button } from './ui';

type DesktopTitleBarProps = {
  title: string;
  onMinimize: () => void;
  onClose: () => void;
};

export function DesktopTitleBar({ title, onMinimize, onClose }: DesktopTitleBarProps) {
  return (
    <header className="desktop-titlebar">
      <div className="desktop-titlebar__drag" />
      <div className="desktop-titlebar__content">
        <div className="desktop-titlebar__brand" aria-hidden="true">
          <span className="desktop-titlebar__brand-mark">O</span>
        </div>
        <div className="desktop-titlebar__copy">
          <strong className="desktop-titlebar__title">{title}</strong>
        </div>
      </div>
      <div className="desktop-titlebar__actions">
        <Button type="button" variant="ghost" className="window-control window-control--compact" onClick={onMinimize} aria-label="最小化">—</Button>
        <Button type="button" variant="ghost" className="window-control window-control--compact window-control--close" onClick={onClose} aria-label="关闭">✕</Button>
      </div>
    </header>
  );
}
