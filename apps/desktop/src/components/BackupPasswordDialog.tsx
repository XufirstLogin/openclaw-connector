import React, { useEffect, useState } from 'react';
import { Button, Field, GlassCard, TextInput } from './ui';

type BackupPasswordDialogProps = {
  open: boolean;
  mode: 'import' | 'export';
  onConfirm: (password: string) => void;
  onCancel: () => void;
};

export function BackupPasswordDialog({ open, mode, onConfirm, onCancel }: BackupPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setError('');
  }, [open, mode]);

  if (!open) {
    return null;
  }

  const isExport = mode === 'export';
  const title = isExport ? '导出备份' : '导入备份';
  const description = isExport
    ? '请设置备份密码。导出的备份文件会整体加密，之后导入时需要使用同一个密码。'
    : '请输入备份密码以解密导入文件。若导入的是旧版未加密备份，可留空继续。';

  const handleSubmit = () => {
    if (isExport) {
      if (!password) {
        setError('请输入备份密码。');
        return;
      }
      if (password.length < 6) {
        setError('备份密码至少需要 6 位。');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的备份密码不一致。');
        return;
      }
    }

    setError('');
    onConfirm(password);
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onCancel}>
      <div
        className="backup-password-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <GlassCard title={title} subtitle={description}>
          <div className="backup-password-dialog__fields stack">
            <Field label="备份密码" error={!isExport ? error : undefined}>
              <TextInput
                type="password"
                placeholder={isExport ? '请设置备份密码' : '请输入备份密码'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) {
                    setError('');
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !isExport) {
                    handleSubmit();
                  }
                }}
              />
            </Field>

            {isExport ? (
              <Field label="确认密码" error={error}>
                <TextInput
                  type="password"
                  placeholder="请再次输入备份密码"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    if (error) {
                      setError('');
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSubmit();
                    }
                  }}
                />
              </Field>
            ) : null}

            <p className="backup-password-dialog__hint">
              {isExport ? '请牢记该密码，未来导入备份时需要使用。' : '旧版明文备份可留空导入，新版加密备份必须输入正确密码。'}
            </p>
          </div>

          <div className="backup-password-dialog__actions">
            <Button type="button" variant="ghost" onClick={onCancel}>取消</Button>
            <Button type="button" onClick={handleSubmit}>{isExport ? '开始导出' : '开始导入'}</Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
