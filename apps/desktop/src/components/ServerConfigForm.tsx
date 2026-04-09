import React, { useState } from 'react';
import type { ServerConfigState } from '../state/configStore';
import { Button, Field, TextArea, TextInput } from './ui';

type ServerConfigFormProps = {
  config: ServerConfigState;
  onFieldChange: (field: keyof ServerConfigState, value: string | number) => void;
};

export function ServerConfigForm({ config, onFieldChange }: ServerConfigFormProps) {
  const [isTokenVisible, setIsTokenVisible] = useState(false);

  return (
    <div className="stack">
      <div className="grid-two">
        <Field label="服务器公网 IP">
          <TextInput
            placeholder="请输入服务器公网 IP 或域名"
            value={config.serverIp}
            onChange={(event) => onFieldChange('serverIp', event.target.value)}
          />
        </Field>
        <Field label="SSH 端口">
          <TextInput
            type="number"
            placeholder="22"
            value={String(config.sshPort)}
            onChange={(event) => onFieldChange('sshPort', Number(event.target.value) || 22)}
          />
        </Field>
      </div>

      <div className="grid-two">
        <Field label="SSH 用户名">
          <TextInput
            placeholder="root"
            value={config.sshUsername}
            onChange={(event) => onFieldChange('sshUsername', event.target.value)}
          />
        </Field>
        <Field label="OpenClaw Token">
          <div className="inline-input-action">
            <TextInput
              type={isTokenVisible ? 'text' : 'password'}
              placeholder="请输入 OpenClaw Token"
              value={config.openclawToken}
              onChange={(event) => onFieldChange('openclawToken', event.target.value)}
            />
            <Button
              className="inline-input-action__button"
              variant="secondary"
              type="button"
              onClick={() => setIsTokenVisible((current) => !current)}
            >
              {isTokenVisible ? '隐藏' : '显示'}
            </Button>
          </div>
        </Field>
      </div>

      <div className="segmented-toggle" role="tablist" aria-label="SSH 登录方式">
        <Button
          type="button"
          variant={config.authType === 'password' ? 'primary' : 'secondary'}
          onClick={() => onFieldChange('authType', 'password')}
        >
          密码认证
        </Button>
        <Button
          type="button"
          variant={config.authType === 'key' ? 'primary' : 'secondary'}
          onClick={() => onFieldChange('authType', 'key')}
        >
          私钥认证
        </Button>
      </div>

      {config.authType === 'password' ? (
        <Field label="SSH 密码">
          <TextInput
            type="password"
            placeholder="输入服务器密码"
            value={config.sshPassword}
            onChange={(event) => onFieldChange('sshPassword', event.target.value)}
          />
        </Field>
      ) : (
        <Field label="SSH 私钥" hint="支持直接粘贴私钥完整内容">
          <TextArea
            rows={10}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            value={config.sshPrivateKey}
            onChange={(event) => onFieldChange('sshPrivateKey', event.target.value)}
          />
        </Field>
      )}
    </div>
  );
}
