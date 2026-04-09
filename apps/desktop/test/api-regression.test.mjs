import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const appSource = fs.readFileSync(path.join(appRoot, 'src', 'App.tsx'), 'utf8');
const appTypesSource = fs.readFileSync(path.join(appRoot, 'src', 'types', 'app.ts'), 'utf8');
const validationSource = fs.readFileSync(path.join(appRoot, 'src', 'lib', 'serverConfigValidation.ts'), 'utf8');
const preferencesSource = fs.readFileSync(path.join(appRoot, 'src', 'state', 'authStore.ts'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(appRoot, 'src', 'types', 'bridge.ts'), 'utf8');
const preloadSource = fs.readFileSync(path.join(appRoot, 'electron', 'preload.ts'), 'utf8');
const electronMainSource = fs.readFileSync(path.join(appRoot, 'electron', 'main.ts'), 'utf8');


const localWorkspacePagePath = path.join(appRoot, 'src', 'pages', 'LocalWorkspacePage.tsx');
const serverEditorPagePath = path.join(appRoot, 'src', 'pages', 'ServerEditorPage.tsx');
const serverCardPath = path.join(appRoot, 'src', 'components', 'ServerCard.tsx');
const serverCardListPath = path.join(appRoot, 'src', 'components', 'ServerCardList.tsx');
const serverDetailPanelPath = path.join(appRoot, 'src', 'components', 'ServerDetailPanel.tsx');
const aboutPagePath = path.join(appRoot, 'src', 'pages', 'AboutPage.tsx');
const confirmDialogPath = path.join(appRoot, 'src', 'components', 'ConfirmDialog.tsx');
const feedbackToastPath = path.join(appRoot, 'src', 'components', 'FeedbackToast.tsx');
const backupPasswordDialogPath = path.join(appRoot, 'src', 'components', 'BackupPasswordDialog.tsx');
const diagnosticsPagePath = path.join(appRoot, 'src', 'pages', 'DiagnosticsPage.tsx');
const settingsPagePath = path.join(appRoot, 'src', 'pages', 'SettingsPage.tsx');
const importPreviewDialogPath = path.join(appRoot, 'src', 'components', 'ImportPreviewDialog.tsx');

const desktopTitleBarPath = path.join(appRoot, 'src', 'components', 'DesktopTitleBar.tsx');
const connectionMessagesPath = path.join(appRoot, 'src', 'lib', 'connectionMessages.ts');
const localProfileClientPath = path.join(appRoot, 'src', 'lib', 'localProfileClient.ts');
const localProfileCryptoPath = path.join(appRoot, 'src', 'lib', 'localProfileCrypto.ts');
const tunnelClientPath = path.join(appRoot, 'src', 'lib', 'tunnelClient.ts');
const stylesPath = path.join(appRoot, 'src', 'styles', 'index.css');

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

const serverDetailPanelSource = readIfExists(serverDetailPanelPath);

test('desktop app launches directly into a local workspace instead of login or reset flows', () => {
  assert.match(appTypesSource, /'workspace'/);
  assert.doesNotMatch(appTypesSource, /'login'|'register'|'forgot-password'/);
  assert.match(appSource, /useState<AppView>\('workspace'\)/);
  assert.match(appSource, /LocalWorkspacePage/);
  assert.doesNotMatch(appSource, /LoginPage|RegisterPage|ResetPasswordPage/);
});

test('desktop local-only workspace page exists as the primary renderer shell', () => {
  assert.ok(fs.existsSync(localWorkspacePagePath), 'Expected LocalWorkspacePage.tsx to exist.');
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.match(localWorkspaceSource, /export function LocalWorkspacePage|export const LocalWorkspacePage/);
});

test('desktop local workspace exposes direct server card actions for connect, edit, and delete', () => {
  assert.ok(fs.existsSync(serverCardPath), 'Expected ServerCard.tsx to exist.');
  assert.ok(fs.existsSync(serverCardListPath), 'Expected ServerCardList.tsx to exist.');
  const serverCardSource = readIfExists(serverCardPath);
  assert.match(serverCardSource, /连接/);
  assert.match(serverCardSource, /编辑/);
  assert.match(serverCardSource, /删除/);
});

test('desktop local workspace surfaces import and export entry points for backups', () => {
  assert.ok(fs.existsSync(localWorkspacePagePath), 'Expected LocalWorkspacePage.tsx to exist.');
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.match(localWorkspaceSource, /导入/);
  assert.match(localWorkspaceSource, /导出/);
});

test('desktop keeps the validated server-config contract for local server editing', () => {
  assert.match(validationSource, /服务器公网 IP|public IP/i);
  assert.match(validationSource, /SSH/);
  assert.match(validationSource, /OpenClaw Token/);
  assert.match(validationSource, /密码|私钥/);
});

test('desktop local workspace provides a duplicate server action for fast cloning', () => {
  assert.match(serverDetailPanelSource, /复制/);
});

test('desktop local workspace persists the last selected server locally between launches', () => {
  assert.match(preferencesSource, /lastSelectedServerId/);
  assert.match(appSource, /readLocalAppPreferences|writeLocalAppPreferences/);
  assert.match(appSource, /selectedServerId|lastSelectedServerId/);
});

test('desktop local workspace uses native desktop import and export flows instead of browser file hacks', () => {
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.doesNotMatch(localWorkspaceSource, /type="file"|Blob\(|createObjectURL|anchor\.click/);
  assert.match(appSource, /importLocalServersFromDialog|exportLocalServersToDialog/);
});

test('desktop uses custom confirmation dialog instead of browser confirm for destructive actions', () => {
  assert.ok(fs.existsSync(confirmDialogPath), 'Expected ConfirmDialog.tsx to exist.');
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  const dialogSource = readIfExists(confirmDialogPath);
  assert.doesNotMatch(localWorkspaceSource, /window\.confirm/);
  assert.match(localWorkspaceSource, /ConfirmDialog/);
  assert.match(dialogSource, /确认删除|确认操作|取消/);
});

test('desktop app exposes in-app feedback toast for success and error states', () => {
  assert.ok(fs.existsSync(feedbackToastPath), 'Expected FeedbackToast.tsx to exist.');
  const toastSource = readIfExists(feedbackToastPath);
  assert.match(appSource, /FeedbackToast/);
  assert.match(toastSource, /success|error|info/);
});

test('desktop server cards show current connection highlight and loading state labels', () => {
  const serverCardSource = readIfExists(serverCardPath);
  assert.match(serverCardSource, /isActiveConnection|isConnecting/);
  assert.match(serverCardSource, /连接中\.\.\.|已连接/);
  assert.match(serverCardSource, /server-card--connected|server-card--connecting/);
});

test('desktop redesign introduces a standalone server editor page', () => {
  assert.ok(fs.existsSync(serverEditorPagePath), 'Expected ServerEditorPage.tsx to exist.');
  const editorSource = readIfExists(serverEditorPagePath);
  assert.match(editorSource, /export function ServerEditorPage|export const ServerEditorPage/);
});

test('desktop redesign mounts a custom desktop title bar in the renderer shell', () => {
  assert.match(appSource, /DesktopTitleBar/);
});

test('desktop redesign keeps the homepage free of the embedded server form', () => {
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.doesNotMatch(localWorkspaceSource, /ServerConfigForm/);
});

test('desktop redesign uses a dedicated right-side server detail panel on the homepage', () => {
  assert.ok(fs.existsSync(serverDetailPanelPath), 'Expected ServerDetailPanel.tsx to exist.');
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.match(localWorkspaceSource, /ServerDetailPanel/);
  assert.match(serverDetailPanelSource, /export function ServerDetailPanel|export const ServerDetailPanel/);
});

test('desktop title bar keeps only minimize and close controls after removing maximize', () => {
  const titleBarSource = readIfExists(path.join(appRoot, 'src', 'components', 'DesktopTitleBar.tsx'));
  assert.match(titleBarSource, /最小化/);
  assert.doesNotMatch(titleBarSource, /最大化|还原/);
  assert.match(titleBarSource, /—/);
  assert.doesNotMatch(titleBarSource, /□|❐/);
  assert.match(titleBarSource, /✕/);
});

test('desktop title bar drops the extra subtitle slogan and keeps a cleaner single-title header', () => {
  const titleBarSource = readIfExists(path.join(appRoot, 'src', 'components', 'DesktopTitleBar.tsx'));
  assert.doesNotMatch(titleBarSource, /desktop-titlebar__subtitle|subtitle\s*:/);
  assert.doesNotMatch(appSource, /shellSubtitle/);
  assert.ok(!appSource.includes('\u6d45\u8272\u79d1\u6280\u73bb\u7483\u611f'));
});

test('desktop detail panel separates primary and secondary action groups for better spacing', () => {
  assert.match(serverDetailPanelSource, /server-detail-panel__primary-actions/);
  assert.match(serverDetailPanelSource, /server-detail-panel__secondary-actions/);
});

test('desktop server card actions use explicit spacing class hooks for balanced button layout', () => {
  const serverCardSource = readIfExists(serverCardPath);
  assert.match(serverCardSource, /server-card__actions/);
  assert.match(serverCardSource, /server-card__action server-card__action--primary/);
  assert.match(serverCardSource, /server-card__action server-card__action--secondary/);
});

test('desktop detail panel keeps action footer visible via dedicated content and footer regions', () => {
  assert.match(serverDetailPanelSource, /server-detail-panel__content/);
  assert.match(serverDetailPanelSource, /server-detail-panel__footer/);
});


test('desktop compact workspace replaces the oversized hero with a toolbar header', () => {
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.match(localWorkspaceSource, /workspace-toolbar/);
  assert.doesNotMatch(localWorkspaceSource, /home-hero/);
});

test('desktop compact detail panel keeps edit actions in an inline action stack instead of a bottom-sunk footer', () => {
  assert.match(serverDetailPanelSource, /server-detail-panel__action-stack/);
});

test('desktop compact editor uses a single compact canvas instead of the previous split content plus footer slabs', () => {
  const editorSource = readIfExists(serverEditorPagePath);
  assert.match(editorSource, /editor-page__canvas/);
  assert.doesNotMatch(editorSource, /editor-page__footer/);
});


test('desktop app exposes a lightweight about page from the local shell', () => {
  assert.match(appTypesSource, /'about'/);
  assert.ok(fs.existsSync(aboutPagePath), 'Expected AboutPage.tsx to exist.');
  const aboutSource = readIfExists(aboutPagePath);
  assert.match(appSource, /AboutPage/);
  assert.match(aboutSource, /\u7248\u672c|\u672c\u5730\u6a21\u5f0f|\u5907\u4efd/);
});

test('desktop editor exposes a test-connection action before saving', () => {
  const editorSource = readIfExists(serverEditorPagePath);
  assert.match(editorSource, /\u6d4b\u8bd5\u8fde\u63a5/);
});

test('desktop editor locks test-and-save actions while another server connection is active', () => {
  const editorSource = readIfExists(serverEditorPagePath);
  assert.match(editorSource, /connectionLocked|isConnectionBusy/);
  assert.match(editorSource, /\u5f53\u524d\u5df2\u6709\u670d\u52a1\u5668\u8fde\u63a5\u4e2d\uff0c\u8bf7\u5148\u65ad\u5f00\u540e\u518d\u6d4b\u8bd5\u6216\u4fdd\u5b58\u914d\u7f6e/);
  assert.match(editorSource, /disabled=\{[^}]*connectionLocked[^}]*\}/);
  assert.match(appSource, /isConnectionBusy|connectionLocked/);
});

test('desktop preflight validation surfaces readable Chinese messages instead of mojibake', () => {
  assert.match(electronMainSource, /\u8bf7\u586b\u5199\u670d\u52a1\u5668\u516c\u7f51 IP/);
  assert.match(electronMainSource, /\u672c\u5730\u7aef\u53e3 18789 \u5df2\u88ab\u5360\u7528/);
  assert.doesNotMatch(electronMainSource, /[?]{3,}/);
});

test('desktop blocks deleting a server that is currently connecting or connected', () => {
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  const serverCardSource = readIfExists(serverCardPath);
  assert.match(appSource, /\u8bf7\u5148\u65ad\u5f00\u5f53\u524d\u8fde\u63a5\u540e\u518d\u5220\u9664\u670d\u52a1\u5668/);
  assert.match(appSource, /activeConnectionServerId === id|busyServerId === id/);
  assert.match(localWorkspaceSource, /cannotDeleteActiveServer|deleteBlocked/);
  assert.match(serverCardSource, /deleteDisabled/);
  assert.match(serverDetailPanelSource, /deleteDisabled/);
});

test('desktop empty workspace guides first-time users with create and import actions', () => {
  const listSource = readIfExists(serverCardListPath);
  assert.match(listSource, /\u65b0\u5efa\u7b2c\u4e00\u53f0\u670d\u52a1\u5668/);
  assert.match(listSource, /\u4ece\u5907\u4efd\u5bfc\u5165/);
});


test('desktop editor footer uses a single-row split action layout for test, cancel, and save', () => {
  const editorSource = readIfExists(serverEditorPagePath);
  assert.match(editorSource, /editor-page__actions-left/);
  assert.match(editorSource, /editor-page__actions-right/);
  assert.match(editorSource, /测试连接/);
  assert.match(editorSource, /取消/);
  assert.match(editorSource, /保存服务器/);
});

test('desktop app includes a backup password dialog for encrypted import and export flows', () => {
  assert.ok(fs.existsSync(backupPasswordDialogPath), 'Expected BackupPasswordDialog.tsx to exist.');
  const dialogSource = readIfExists(backupPasswordDialogPath);
  assert.match(dialogSource, /备份密码/);
  assert.match(dialogSource, /导入备份|导出备份/);
  assert.match(appSource, /BackupPasswordDialog/);
});


test('desktop renderer subscribes to tunnel status changes so tray disconnects sync back into the workspace', () => {
  assert.match(appSource, /subscribeTunnelStatus/);
  assert.match(appSource, /setStatus\(snapshot\.status\)/);
  assert.match(appSource, /setActiveConnectionServerId\(/);
});


test('desktop bridge exposes autostart preference methods', () => {
  assert.match(bridgeSource, /getAutostartEnabled/);
  assert.match(bridgeSource, /setAutostartEnabled/);
  assert.match(preloadSource, /getAutostartEnabled/);
  assert.match(preloadSource, /setAutostartEnabled/);
});


test('desktop renderer surfaces a customer-facing autostart toggle', () => {
  const aboutSource = readIfExists(aboutPagePath);
  assert.ok(aboutSource.includes('\u5f00\u673a\u81ea\u52a8\u542f\u52a8') || aboutSource.includes('\u81ea\u542f\u52a8'));
  assert.match(appSource, /getAutostartEnabled|setAutostartEnabled/);
});


test('desktop app adds dedicated diagnostics and settings views to the local shell', () => {
  assert.match(appTypesSource, /'diagnostics'/);
  assert.match(appTypesSource, /'settings'/);
  assert.ok(fs.existsSync(diagnosticsPagePath), 'Expected DiagnosticsPage.tsx to exist.');
  assert.ok(fs.existsSync(settingsPagePath), 'Expected SettingsPage.tsx to exist.');
  assert.match(appSource, /DiagnosticsPage/);
  assert.match(appSource, /SettingsPage/);
});

test('desktop settings page splits into general, connection, backup, and about sections', () => {
  const settingsSource = readIfExists(settingsPagePath);
  assert.match(settingsSource, /\u901a\u7528\u8bbe\u7f6e/);
  assert.match(settingsSource, /\u8fde\u63a5\u8bbe\u7f6e/);
  assert.match(settingsSource, /\u5907\u4efd\u6062\u590d/);
  assert.match(settingsSource, /\u5173\u4e8e\u7248\u672c/);
});

test('desktop diagnostics page surfaces recent connection logs with copy and clear actions', () => {
  const diagnosticsSource = readIfExists(diagnosticsPagePath);
  assert.match(diagnosticsSource, /\u8fde\u63a5\u65e5\u5fd7|\u8bca\u65ad/);
  assert.match(diagnosticsSource, /\u590d\u5236/);
  assert.match(diagnosticsSource, /\u6e05\u7a7a/);
});

test('desktop bridge exposes diagnostics, import-preview, and preflight contracts', () => {
  assert.match(bridgeSource, /listDiagnostics/);
  assert.match(bridgeSource, /clearDiagnostics/);
  assert.match(bridgeSource, /previewImport/);
  assert.match(bridgeSource, /runPreflightChecks/);
  assert.match(preloadSource, /listDiagnostics/);
  assert.match(preloadSource, /previewImport/);
  assert.match(preloadSource, /runPreflightChecks/);
});

test('desktop import flow uses a preview dialog before append-importing encrypted backups', () => {
  assert.ok(fs.existsSync(importPreviewDialogPath), 'Expected ImportPreviewDialog.tsx to exist.');
  const previewSource = readIfExists(importPreviewDialogPath);
  assert.match(previewSource, /\u65b0\u589e|\u91cd\u590d|\u8df3\u8fc7/);
  assert.match(appSource, /ImportPreviewDialog/);
  assert.match(appSource, /previewImport/);
});

test('desktop stronger validation and preflight messaging cover token sanity, local port conflicts, and SSH reachability', () => {
  assert.match(validationSource, /token|Token|\u4ee4\u724c/);
  assert.match(bridgeSource, /Preflight|runPreflightChecks/);
  assert.match(appSource, /preflight|runPreflightChecks|\u7aef\u53e3\u88ab\u5360\u7528|SSH/);
});

test('desktop connection failure copy tells users what to check next and where to diagnose', () => {
  const connectionMessagesSource = readIfExists(connectionMessagesPath);
  assert.match(connectionMessagesSource, /请检查公网 IP/);
  assert.match(connectionMessagesSource, /安全组|防火墙|网络/);
  assert.match(connectionMessagesSource, /诊断页|连接日志/);
});

test('desktop workspace toolbar consolidates live connection target and status into a compact summary rail', () => {
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.match(appSource, /statusServerName|setStatusServerName/);
  assert.match(appSource, /statusServerIp|setStatusServerIp/);
  assert.match(localWorkspaceSource, /workspace-toolbar__summary/);
  assert.match(localWorkspaceSource, /workspace-toolbar__status-text/);
  assert.match(localWorkspaceSource, /connectionStatusLabel|connectionTargetLabel/);
});

test('desktop workspace toolbar top-aligns the left title block instead of sinking it to the bottom', () => {
  const stylesSource = readIfExists(stylesPath);
  assert.match(stylesSource, /\.workspace-toolbar\s*\{[^}]*align-items:\s*start;/s);
  assert.doesNotMatch(stylesSource, /\.workspace-toolbar\s*\{[^}]*align-items:\s*end;/s);
});


test('desktop workspace adopts approved scheme A with a left hero and right metric rail', () => {
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.match(localWorkspaceSource, /workspace-toolbar__hero/);
  assert.match(localWorkspaceSource, /workspace-toolbar__identity/);
  assert.match(localWorkspaceSource, /workspace-toolbar__metrics/);
  assert.match(localWorkspaceSource, /workspace-toolbar__quick-actions/);
});


test('desktop workspace scheme A keeps customer-facing Chinese copy intact instead of question marks', () => {
  const localWorkspaceSource = readIfExists(localWorkspacePagePath);
  assert.ok(localWorkspaceSource.includes('\u672c\u5730\u6a21\u5f0f'));
  assert.ok(localWorkspaceSource.includes('\u670d\u52a1\u5668\u5de5\u4f5c\u533a'));
  assert.ok(localWorkspaceSource.includes('\u670d\u52a1\u5668\u6570\u91cf'));
  assert.ok(localWorkspaceSource.includes('\u9ed8\u8ba4\u670d\u52a1\u5668'));
  assert.ok(localWorkspaceSource.includes('\u5f53\u524d\u8fde\u63a5'));
  assert.doesNotMatch(localWorkspaceSource, /[?]{3,}/);
});

test('desktop workspace scheme A styles the metric rail and quick actions as dedicated dashboard regions', () => {
  const stylesSource = readIfExists(stylesPath);
  assert.match(stylesSource, /\.workspace-toolbar__hero\s*\{/);
  assert.match(stylesSource, /\.workspace-toolbar__metrics[\s\S]*display:\s*grid;/);
  assert.match(stylesSource, /\.workspace-toolbar__quick-actions\s*\{/);
  assert.match(stylesSource, /\.workspace-toolbar__metric\s*\{/);
});


test('desktop window controls use a custom focus ring instead of the default orange outline', () => {
  const stylesSource = readIfExists(stylesPath);
  assert.match(stylesSource, /\.window-control(?::focus|--compact:focus|:focus-visible|--compact:focus-visible)[\s\S]*outline:\s*none;/);
  assert.match(stylesSource, /\.window-control(?::focus|--compact:focus|:focus-visible|--compact:focus-visible)[\s\S]*box-shadow:\s*0 0 0 3px/);
});

test('desktop close-to-tray removes the taskbar entry while minimize keeps the window in the taskbar', () => {
  assert.match(electronMainSource, /function showMainWindow\(\)[\s\S]*setSkipTaskbar\(false\)[\s\S]*show\(\)/);
  assert.match(electronMainSource, /function hideMainWindowToTray\(\)[\s\S]*setSkipTaskbar\(true\)[\s\S]*hide\(\)/);
  assert.match(electronMainSource, /openclaw:window:minimize[\s\S]*setSkipTaskbar\(false\)[\s\S]*minimize\(\)/);
  assert.match(electronMainSource, /win\.on\('close',[\s\S]*hideMainWindowToTray\(\)/);
});

test('desktop settings keeps version info customer-focused and downgrades source note styling', () => {
  const settingsSource = readIfExists(settingsPagePath);
  const aboutSource = readIfExists(aboutPagePath);
  assert.match(bridgeSource, /getMetadata/);
  assert.match(preloadSource, /openclaw:app:get-metadata/);
  assert.match(settingsSource, /\u7248\u6743\u5f52\u5c5e/);
  assert.match(settingsSource, /CSDN \u4f5c\u8005/);
  assert.match(settingsSource, /\u5c0f\u5c0f\u8bb8\u4e0b\u58eb/);
  assert.match(settingsSource, /weixin_46085234/);
  assert.match(settingsSource, /\u4f5c\u54c1\u6765\u6e90\u8bf4\u660e/);
  assert.doesNotMatch(settingsSource, /\u6570\u636e\u76ee\u5f55/);
  assert.doesNotMatch(settingsSource, /\u65e5\u5fd7\u76ee\u5f55/);
  assert.match(settingsSource, /about-page__source-note--subtle/);
  assert.match(aboutSource, /\u4f5c\u54c1\u6765\u6e90\u8bf4\u660e/);
});



test('desktop customer-facing sources avoid mojibake or placeholder question-mark text', () => {
  const sources = [
    readIfExists(desktopTitleBarPath),
    readIfExists(localWorkspacePagePath),
    readIfExists(feedbackToastPath),
    readIfExists(backupPasswordDialogPath),
    readIfExists(settingsPagePath),
    readIfExists(diagnosticsPagePath),
    readIfExists(connectionMessagesPath),
    readIfExists(localProfileClientPath),
    readIfExists(localProfileCryptoPath),
    readIfExists(tunnelClientPath),
    appSource,
  ].join('\n');

    assert.doesNotMatch(sources, /[?]{3,}/);
});

test('desktop settings layout uses a single-column customer-friendly card stack instead of the old two-column spread', () => {
  const stylesSource = readIfExists(stylesPath);
  assert.match(stylesSource, /settings-page__container/);
  assert.doesNotMatch(stylesSource, /settings-page__grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
});
