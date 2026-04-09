import React from 'react';

type CardProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export function GlassCard({ title, subtitle, children, actions, className = '' }: CardProps) {
  return (
    <section className={`glass-card ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <header className="glass-card__header">
          <div>
            {title ? <h2 className="glass-card__title">{title}</h2> : null}
            {subtitle ? <p className="glass-card__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="glass-card__actions">{actions}</div> : null}
        </header>
      )}
      <div className="glass-card__body">{children}</div>
    </section>
  );
}
