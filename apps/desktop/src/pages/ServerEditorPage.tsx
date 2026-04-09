import React, { useMemo, useState } from 'react';
import { ServerConfigForm } from '../components/ServerConfigForm';
import { Button, Field, TextArea, TextInput } from '../components/ui';
import { describeTunnelFailure } from '../lib/connectionMessages';
import { runTunnelPreflightChecks, testTunnelConnection } from '../lib/tunnelClient';
import { validateServerConfig } from '../lib/serverConfigValidation';
import { defaultServerConfigState, type ServerConfigState } from '../state/configStore';
import type { EditorMode } from '../types/app';
import type { LocalServerRecord, SaveLocalServerInput } from '../types/localProfile';

type LocalServerEditorDraft = SaveLocalServerInput & ServerConfigState;

type ServerEditorPageProps = {
  mode: EditorMode;
  sourceServer?: LocalServerRecord | null;
  connectionLocked?: boolean;
  connectionLockedMessage?: string;
  onBack: () => void;
  onSave: (input: SaveLocalServerInput) => Promise<void>;
};

function createDraft(mode: EditorMode, server?: LocalServerRecord | null): LocalServerEditorDraft {
  if (!server || mode === 'create') {
    return {
      id: undefined,
      name: '',
      remark: '',
      isDefault: false,
      ...defaultServerConfigState,
    };
  }

  return {
    id: mode === 'duplicate' ? undefined : server.id,
    name: mode === 'duplicate' ? `${server.name || server.serverIp} 副本` : server.name,
    remark: server.remark,
    isDefault: mode === 'duplicate' ? false : server.isDefault,
    serverIp: server.serverIp,
    sshPort: server.sshPort,
    sshUsername: server.sshUsername,
    authType: server.authType,
    sshPassword: server.sshPassword,
    sshPrivateKey: server.sshPrivateKey,
    openclawToken: server.openclawToken,
  };
}

function toServerConfig(draft: LocalServerEditorDraft): ServerConfigState {
  return {
    serverIp: draft.serverIp,
    sshPort: draft.sshPort,
    sshUsername: draft.sshUsername,
    authType: draft.authType,
    sshPassword: draft.sshPassword,
    sshPrivateKey: draft.sshPrivateKey,
    openclawToken: draft.openclawToken,
  };
}

export function ServerEditorPage({
  mode,
  sourceServer,
  connectionLocked = false,
  connectionLockedMessage = '当前已有服务器连接中，请先断开后再测试或保存配置。',
  onBack,
  onSave,
}: ServerEditorPageProps) {
  const [draft, setDraft] = useState<LocalServerEditorDraft>(() => createDraft(mode, sourceServer));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editorError, setEditorError] = useState('');
  const [editorNotice, setEditorNotice] = useState('');

  const pageTitle = useMemo(() => {
    if (mode === 'create') {
      return '新建服务器';
    }

    if (mode === 'duplicate') {
      return '复制服务器';
    }

    return `编辑服务器 · ${sourceServer?.name || sourceServer?.serverIp || '未命名服务器'}`;
  }, [mode, sourceServer]);

  const handleFieldChange = (field: keyof LocalServerEditorDraft, value: string | number | boolean | undefined) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleConfigFieldChange = (field: keyof ServerConfigState, value: string | number) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const validateDraft = () => {
    const validationError = validateServerConfig(toServerConfig(draft));
    if (validationError) {
      setEditorNotice('');
      setEditorError(validationError);
      return false;
    }
    return true;
  };

  const runPreflight = async () => {
    const result = await runTunnelPreflightChecks(toServerConfig(draft));
    if (!result.ok) {
      setEditorNotice('');
      setEditorError(`连接前校验未通过：${result.issues.join('；')}`);
      return false;
    }
    return true;
  };

  const handleTestConnection = async () => {
    if (connectionLocked) {
      setEditorNotice('');
      setEditorError(connectionLockedMessage);
      return;
    }

    if (!validateDraft()) {
      return;
    }

    setTesting(true);
    setEditorError('');
    setEditorNotice('正在测试连接，请稍候…');

    try {
      const preflightPassed = await runPreflight();
      if (!preflightPassed) {
        return;
      }

      const result = await testTunnelConnection(toServerConfig(draft));
      if (!result.connected) {
        setEditorNotice('');
        setEditorError(`测试连接失败：${describeTunnelFailure(result.reason)}`);
        return;
      }

      setEditorNotice('测试连接成功，可以保存配置后正式使用。');
    } catch (error) {
      setEditorNotice('');
      setEditorError(`测试连接失败：${describeTunnelFailure(error instanceof Error ? error.message : '')}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    if (connectionLocked) {
      setEditorNotice('');
      setEditorError(connectionLockedMessage);
      return;
    }

    if (!validateDraft()) {
      return;
    }

    setSaving(true);
    setEditorError('');

    try {
      const preflightPassed = await runPreflight();
      if (!preflightPassed) {
        return;
      }

      await onSave({
        id: draft.id,
        name: draft.name,
        remark: draft.remark,
        isDefault: draft.isDefault,
        serverIp: draft.serverIp,
        sshPort: draft.sshPort,
        sshUsername: draft.sshUsername,
        authType: draft.authType,
        sshPassword: draft.sshPassword,
        sshPrivateKey: draft.sshPrivateKey,
        openclawToken: draft.openclawToken,
      });
    } catch (saveError) {
      setEditorError(saveError instanceof Error ? saveError.message : '保存服务器失败。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-page">
      <section className="editor-page__canvas glass-card">
        <div className="editor-page__topbar">
          <div className="editor-page__intro">
            <span className="page-heading__eyebrow">本地服务器配置</span>
            <h1 className="editor-page__title">{pageTitle}</h1>
            <p className="editor-page__desc">保存前可先测试连接，确认 SSH、OpenClaw Token 和本地端口状态可用后再写入本地加密存储。</p>
          </div>
          <Button type="button" variant="ghost" onClick={onBack}>返回首页</Button>
        </div>

        <div className="editor-page__sections">
          <section className="editor-page__section">
            <div className="editor-page__section-head">
              <h2>基本信息</h2>
              <p>这些内容用于卡片标题、备注和默认服务器识别。</p>
            </div>
            <div className="stack">
              <div className="grid-two">
                <Field label="显示名称" hint="卡片标题">
                  <TextInput
                    placeholder="例如：杭州主机"
                    value={draft.name}
                    onChange={(event) => handleFieldChange('name', event.target.value)}
                  />
                </Field>
                <Field label="默认服务器" hint="启动后优先选中">
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.isDefault)}
                      onChange={(event) => handleFieldChange('isDefault', event.target.checked)}
                    />
                    <span>{draft.isDefault ? '已设为默认' : '设为默认'}</span>
                  </label>
                </Field>
              </div>
              <Field label="备注">
                <TextArea
                  rows={4}
                  placeholder="可填写客户名称、机器用途、环境说明等"
                  value={draft.remark ?? ''}
                  onChange={(event) => handleFieldChange('remark', event.target.value)}
                />
              </Field>
            </div>
          </section>

          <section className="editor-page__section">
            <div className="editor-page__section-head">
              <h2>连接信息</h2>
              <p>填写 SSH 与 OpenClaw 所需的远程连接配置。</p>
            </div>
            <ServerConfigForm config={toServerConfig(draft)} onFieldChange={handleConfigFieldChange} />
          </section>
        </div>

        {connectionLocked ? <div className="banner banner--error">{connectionLockedMessage}</div> : null}
        {editorError ? <div className="banner banner--error">{editorError}</div> : null}
        {editorNotice ? <div className="banner banner--info">{editorNotice}</div> : null}

        <div className="editor-page__actions">
          <div className="editor-page__actions-left">
            <Button
              type="button"
              variant="secondary"
              className="editor-page__action-button"
              onClick={() => { void handleTestConnection(); }}
              disabled={testing || saving || connectionLocked}
            >
              {testing ? '测试中…' : '测试连接'}
            </Button>
          </div>
          <div className="editor-page__actions-right">
            <Button type="button" variant="ghost" className="editor-page__action-button" onClick={onBack}>取消</Button>
            <Button
              type="button"
              className="editor-page__action-button editor-page__action-button--primary"
              onClick={() => { void handleSubmit(); }}
              disabled={saving || testing || connectionLocked}
            >
              {saving ? '保存中...' : '保存服务器'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
