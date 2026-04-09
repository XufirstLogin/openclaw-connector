import React from 'react';
import { Button, Field, GlassCard, TextInput } from '../components/ui';

type LoginPageProps = {
  email: string;
  password: string;
  loading?: boolean;
  infoMessage?: string;
  error?: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onSwitchToForgotPassword: () => void;
  onSwitchToRegister: () => void;
};

export function LoginPage({
  email,
  password,
  loading,
  infoMessage,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onSwitchToForgotPassword,
  onSwitchToRegister,
}: LoginPageProps) {
  return (
    <div className="auth-layout">
      <div className="hero-copy">
        <span className="hero-copy__eyebrow">OpenClaw Connector</span>
        <h1 className="hero-copy__title">一键连接你的远程 OpenClaw 工作台</h1>
        <p className="hero-copy__desc">
          登录后保存服务器公网 IP、SSH 凭证和 OpenClaw Token，点击连接即可自动建立隧道并打开 GUI 页面。
        </p>
      </div>

      <GlassCard
        className="auth-card"
        title="欢迎回来"
        subtitle="登录你的账号以继续使用桌面连接器"
      >
        <div className="stack">
          <Field label="邮箱">
            <TextInput
              placeholder="name@example.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </Field>
          <Field label="密码">
            <TextInput
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </Field>
          {infoMessage ? <div className="banner banner--success">{infoMessage}</div> : null}
          {error ? <div className="banner banner--error">{error}</div> : null}
          <Button block onClick={onSubmit} disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
          <Button variant="secondary" block onClick={onSwitchToForgotPassword}>
            忘记密码
          </Button>
          <Button variant="ghost" block onClick={onSwitchToRegister}>
            没有账号？去注册
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
