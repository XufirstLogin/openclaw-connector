import React from 'react';
import { Button, Field, GlassCard, TextInput } from '../components/ui';

type ResetPasswordPageProps = {
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
  onBackToLogin: () => void;
};

export function ResetPasswordPage({
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
  onBackToLogin,
}: ResetPasswordPageProps) {
  return (
    <div className="auth-layout">
      <div className="hero-copy">
        <span className="hero-copy__eyebrow">OpenClaw Connector</span>
        <h1 className="hero-copy__title">重置密码</h1>
        <p className="hero-copy__desc">输入注册邮箱并接收验证码，验证后即可设置新密码并返回登录。</p>
      </div>

      <GlassCard className="auth-card" title="找回账号" subtitle="通过邮箱验证码重置登录密码">
        <div className="stack">
          <Field label="邮箱">
            <TextInput
              placeholder="name@example.com"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </Field>
          <div className="row row--tight">
            <Field label="验证码">
              <TextInput
                placeholder="输入邮箱验证码"
                value={code}
                onChange={(event) => onCodeChange(event.target.value)}
              />
            </Field>
            <Button className="align-end" variant="secondary" onClick={onSendCode} disabled={sendingCode}>
              {sendingCode ? '发送中...' : '发送验证码'}
            </Button>
          </div>
          <Field label="新密码">
            <TextInput
              type="password"
              placeholder="设置新密码"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </Field>
          <Field label="确认新密码">
            <TextInput
              type="password"
              placeholder="再次输入新密码"
              value={confirmPassword}
              onChange={(event) => onConfirmPasswordChange(event.target.value)}
            />
          </Field>
          {infoMessage ? <div className="banner banner--success">{infoMessage}</div> : null}
          {error ? <div className="banner banner--error">{error}</div> : null}
          <Button block onClick={onSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '设置新密码'}
          </Button>
          <Button variant="ghost" block onClick={onBackToLogin}>
            返回登录
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
