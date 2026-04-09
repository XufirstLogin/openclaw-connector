import React from 'react';
import { Button, Field, GlassCard, TextInput } from '../components/ui';

type RegisterPageProps = {
  email: string;
  code: string;
  password: string;
  confirmPassword: string;
  sendingCode?: boolean;
  submitting?: boolean;
  infoMessage?: string;
  error?: string;
  onEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSendCode: () => void;
  onSubmit: () => void;
  onSwitchToLogin: () => void;
};

export function RegisterPage({
  email,
  code,
  password,
  confirmPassword,
  sendingCode,
  submitting,
  infoMessage,
  error,
  onEmailChange,
  onCodeChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSendCode,
  onSubmit,
  onSwitchToLogin,
}: RegisterPageProps) {
  return (
    <div className="auth-layout auth-layout--register">
      <div className="hero-copy">
        <span className="hero-copy__eyebrow">Cloud Account</span>
        <h1 className="hero-copy__title">创建一个账号开始管理你的 OpenClaw 入口</h1>
        <p className="hero-copy__desc">
          通过邮箱验证码注册，之后你可以在设置中保存一台服务器配置，并在桌面端安全地发起 SSH 隧道连接。
        </p>
      </div>

      <GlassCard className="auth-card" title="注册账号" subtitle="邮箱验证码 + 密码完成创建">
        <div className="stack">
          <Field label="邮箱">
            <TextInput
              placeholder="name@example.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </Field>
          <div className="row row--tight">
            <Field label="验证码" hint="6 位数字">
              <TextInput
                placeholder="123456"
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
              />
            </Field>
            <Button className="align-end" variant="secondary" onClick={onSendCode} disabled={sendingCode}>
              {sendingCode ? '发送中...' : '发送验证码'}
            </Button>
          </div>
          {infoMessage ? <div className="banner banner--info">{infoMessage}</div> : null}
          {error ? <div className="banner banner--error">{error}</div> : null}
          <Field label="密码">
            <TextInput
              type="password"
              placeholder="至少 8 位"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </Field>
          <Field label="确认密码">
            <TextInput
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
            />
          </Field>
          <Button block onClick={onSubmit} disabled={submitting}>
            {submitting ? '注册中...' : '注册并进入'}
          </Button>
          <Button variant="ghost" block onClick={onSwitchToLogin}>
            已有账号？返回登录
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
