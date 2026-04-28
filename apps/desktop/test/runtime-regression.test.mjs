import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const viteConfigSource = fs.readFileSync(path.join(appRoot, 'vite.config.ts'), 'utf8');
const ssh2Source = fs.readFileSync(
  path.join(appRoot, 'electron', 'tunnel', 'adapters', 'Ssh2TunnelAdapter.ts'),
  'utf8',
);
const appSource = fs.readFileSync(path.join(appRoot, 'src', 'App.tsx'), 'utf8');
const apiSource = fs.readFileSync(path.join(appRoot, 'src', 'lib', 'api.ts'), 'utf8');
const authStoreSource = fs.readFileSync(path.join(appRoot, 'src', 'state', 'authStore.ts'), 'utf8');
const preloadSource = fs.readFileSync(path.join(appRoot, 'electron', 'preload.ts'), 'utf8');
const mainSource = fs.readFileSync(path.join(appRoot, 'electron', 'main.ts'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(appRoot, 'src', 'types', 'bridge.ts'), 'utf8');
const ipcHandlersSource = fs.readFileSync(path.join(appRoot, 'electron', 'ipc', 'localProfileHandlers.ts'), 'utf8');
const stylesSource = fs.readFileSync(path.join(appRoot, 'src', 'styles', 'index.css'), 'utf8');
const connectionStatusCardSource = fs.readFileSync(path.join(appRoot, 'src', 'components', 'ConnectionStatusCard.tsx'), 'utf8');
const tunnelManagerSource = fs.readFileSync(path.join(appRoot, 'electron', 'tunnelManager.ts'), 'utf8');

function matchAny(source, patterns, message) {
  const matched = patterns.some((pattern) => pattern.test(source));
  assert.ok(matched, message);
}

test('desktop dev electron script waits for the built cjs entry and launches the app shell', () => {
  assert.match(packageJson.scripts['dev:electron'], /file:\.\/dist-electron\/main\.cjs/);
  assert.match(packageJson.scripts['dev:electron'], /electron\s+\.$/);
});

test('desktop package declares ssh2 runtime dependency', () => {
  assert.ok(packageJson.dependencies?.ssh2, 'Expected package.json dependencies.ssh2 to be set.');
});

test('ssh2 adapter avoids eval-based runtime loading', () => {
  assert.doesNotMatch(ssh2Source, /eval\((['"])require\1\)/);
});

test('ssh2 forwarding failures are handled in-process instead of bubbling as unhandled socket errors', () => {
  assert.doesNotMatch(ssh2Source, /localSocket\.destroy\(error\)/);
  assert.match(ssh2Source, /localSocket\.(?:on|once)\('error'/);
  assert.match(ssh2Source, /OpenClaw.*无法通过隧道访问|SSH.*通道.*失败/i);
});

test('desktop main-process tsup scripts keep electron external', () => {
  assert.match(packageJson.scripts['dev:main'], /--external\s+electron|--external=electron/);
  assert.match(packageJson.scripts['build:main'], /--external\s+electron|--external=electron/);
});

test('desktop package exposes the Electron main entry for app launch', () => {
  assert.equal(packageJson.main, 'dist-electron/main.cjs');
  assert.match(packageJson.scripts['dev:electron'], /electron\s+\.$/);
});

test('desktop renderer build uses relative asset paths for packaged file loading', () => {
  assert.match(viteConfigSource, /base:\s*['"]\.\/['"]/);
});

test('desktop shipped app shell no longer imports HTTP account api client', () => {
  assert.doesNotMatch(appSource, /\.\/lib\/api/);
  assert.doesNotMatch(appSource, /apiClient/);
});

test('desktop shipped app shell no longer imports auth session store', () => {
  assert.doesNotMatch(appSource, /accessToken|refreshToken|AUTH_STORAGE_KEY/);
  assert.doesNotMatch(authStoreSource, /accessToken|refreshToken|AUTH_STORAGE_KEY/);
});

test('desktop shipped renderer no longer hardcodes an account api base url', () => {
  assert.doesNotMatch(apiSource, /127\.0\.0\.1:3000/);
  assert.doesNotMatch(apiSource, /baseUrl/);
  assert.doesNotMatch(apiSource, /Authorization/);
});

test('desktop package text describes a local-only connector product', () => {
  assert.match(packageJson.description ?? '', /local|本地/i);
  assert.doesNotMatch(packageJson.description ?? '', /managed SSH tunnel/i);
});

test('desktop preload bridge exposes native import and export dialog methods for backups', () => {
  assert.match(bridgeSource, /importFromDialog/);
  assert.match(bridgeSource, /exportToDialog/);
  assert.match(preloadSource, /importFromDialog/);
  assert.match(preloadSource, /exportToDialog/);
});

test('desktop main process registers native dialog-backed import and export handlers', () => {
  assert.match(mainSource, /dialog/);
  assert.match(ipcHandlersSource, /showOpenDialog/);
  assert.match(ipcHandlersSource, /showSaveDialog/);
  assert.match(ipcHandlersSource, /openclaw:profile:import-dialog/);
  assert.match(ipcHandlersSource, /openclaw:profile:export-dialog/);
});

test('desktop styles include overlay treatment for feedback toast and confirmation dialog', () => {
  assert.match(stylesSource, /toast-overlay|feedback-toast/);
  assert.match(stylesSource, /modal-overlay|confirm-dialog/);
});

test('desktop connection status card exposes loading button labels for connect and disconnect', () => {
  assert.match(connectionStatusCardSource, /连接中\.\.\.|断开中\.\.\./);
  assert.match(connectionStatusCardSource, /activeServerName|isBusy/);
});

test('desktop redesign uses a frameless BrowserWindow shell', () => {
  matchAny(mainSource, [/frame:\s*false/, /titleBarStyle:\s*['"]hidden/i], 'Expected main.ts to configure a frameless or hidden-title-bar shell.');
});

test('desktop redesign exposes only minimize and close window control bridge methods', () => {
  assert.match(preloadSource, /windowControls/);
  matchAny(preloadSource, [/minimize\s*:/, /minimize\(/], 'Expected preload windowControls minimize bridge.');
  assert.doesNotMatch(preloadSource, /toggleMaximize\s*:/);
  matchAny(preloadSource, [/close\s*:/, /close\(/], 'Expected preload windowControls close bridge.');
});

test('desktop redesign defines typed minimize and close window bridge contracts without maximize', () => {
  assert.match(bridgeSource, /windowControls/);
  matchAny(bridgeSource, [/interface\s+WindowControlsBridge/, /type\s+WindowControlsBridge/], 'Expected a typed WindowControlsBridge contract.');
  matchAny(bridgeSource, [/minimize:\s*\(/, /minimize\(\)\s*:/], 'Expected minimize typing.');
  assert.doesNotMatch(bridgeSource, /toggleMaximize:\s*\(|toggleMaximize\(\)\s*:/);
  matchAny(bridgeSource, [/close:\s*\(/, /close\(\)\s*:/], 'Expected close typing.');
});

test('desktop shell disables freeform manual resizing and also disables maximize', () => {
  assert.match(mainSource, /width:\s*1440/);
  assert.match(mainSource, /height:\s*960/);
  assert.match(mainSource, /minWidth:\s*1440/);
  assert.match(mainSource, /minHeight:\s*960/);
  assert.match(mainSource, /resizable:\s*false/);
  assert.match(mainSource, /maximizable:\s*false/);
  assert.match(mainSource, /minimizable:\s*true/);
});

test('desktop styles reserve dedicated spacing blocks for right-panel action rows and compact window controls', () => {
  assert.match(stylesSource, /server-detail-panel__primary-actions/);
  assert.match(stylesSource, /server-detail-panel__secondary-actions/);
  assert.match(stylesSource, /window-control--compact/);
});

test('desktop styles avoid hover translation that clips the top border of the first server card', () => {
  assert.match(stylesSource, /server-card:hover/);
  assert.doesNotMatch(stylesSource, /server-card:hover\s*\{[^}]*translateY\(-1px\)/s);
});

test('desktop compact styling defines a workspace toolbar and removes the oversized hero block', () => {
  assert.match(stylesSource, /workspace-toolbar/);
  assert.doesNotMatch(stylesSource, /home-hero/);
});

test('desktop compact detail actions are no longer pushed down with an auto top margin footer hack', () => {
  assert.match(stylesSource, /server-detail-panel__action-stack/);
  assert.doesNotMatch(stylesSource, /server-detail-panel__footer\s*\{[^}]*margin-top:\s*auto/s);
});

test('desktop compact editor styling exposes a single canvas and avoids the old two-column editor grid', () => {
  assert.match(stylesSource, /editor-page__canvas/);
  assert.doesNotMatch(stylesSource, /editor-page__content\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
});


test('desktop tunnel bridge exposes a dedicated test-connection method for pre-save validation', () => {
  assert.match(bridgeSource, /testConnection/);
  assert.match(preloadSource, /testConnection/);
  assert.match(mainSource, /openclaw:tunnel:test/);
});

test('desktop tunnel connect and test flows verify the forwarded OpenClaw endpoint before reporting success', () => {
  assert.match(tunnelManagerSource, /async function verifyOpenClawEndpoint/);
  assert.match(tunnelManagerSource, /http\.get|http\.request/);
  assert.ok(
    (tunnelManagerSource.match(/await verifyOpenClawEndpoint\(config\.openclawPort\)/g) ?? []).length >= 2,
    'Expected both connect and testConnection flows to validate the forwarded OpenClaw port.',
  );
  assert.match(tunnelManagerSource, /OpenClaw.*端口.*未在预期时间内响应|OpenClaw.*端口.*无法通过隧道访问/i);
});

test('desktop detail panel body no longer uses a stretching row formula that can push footer actions below the fold', () => {
  assert.match(stylesSource, /server-detail-panel__body/);
  assert.doesNotMatch(stylesSource, /server-detail-panel__body\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto/s);
});





test('desktop main process creates a tray menu and keeps the app alive outside the main window', () => {
  assert.match(mainSource, /\bTray\b/);
  assert.match(mainSource, /setContextMenu/);
  assert.ok(mainSource.includes('\\u663e\\u793a\\u4e3b\\u7a97\\u53e3'));
  assert.ok(mainSource.includes('\\u9000\\u51fa\\u8f6f\\u4ef6'));
});

test('desktop close behavior hides the window to tray instead of quitting immediately', () => {
  assert.match(mainSource, /win\.on\('close'/);
  assert.match(mainSource, /event\.preventDefault\(\)/);
  assert.match(mainSource, /win\.hide\(\)/);
  assert.match(mainSource, /isQuitting/);
});

test('desktop minimize control keeps the window in the taskbar while close still hides it to tray', () => {
  assert.match(mainSource, /ipcMain\.handle\('openclaw:window:minimize'/);
  assert.match(mainSource, /mainWindow\?\.minimize\(\)/);
  assert.match(mainSource, /ipcMain\.handle\('openclaw:window:close'/);
  assert.match(mainSource, /hideMainWindowToTray\(\)/);
});


test('desktop tray supports double-click restore, server-name status text, and renderer status broadcasts', () => {
  assert.match(mainSource, /tray\.on\('double-click'/);
  assert.match(mainSource, /tunnelManager\.getStatus\(\)/);
  assert.ok(mainSource.includes('\\u5f53\\u524d\\u72b6\\u6001'));
  assert.match(mainSource, /serverName/);
  assert.match(mainSource, /webContents\.send\('openclaw:tunnel:status-changed'/);
  assert.match(mainSource, /enabled:\s*canDisconnect/);
  assert.match(mainSource, /refreshTrayMenu\(\)/);
});


test('desktop main process exposes autostart handlers for Windows startup registration', () => {
  assert.match(mainSource, /openclaw:settings:autostart:get/);
  assert.match(mainSource, /openclaw:settings:autostart:set/);
  assert.match(mainSource, /setLoginItemSettings|getLoginItemSettings/);
});

test('desktop tray menu adds quick connect, reconnect, and open-openclaw shortcuts', () => {
  assert.ok(mainSource.includes('\u8fde\u63a5\u5f53\u524d\u670d\u52a1\u5668') || mainSource.includes('???????'));
  assert.ok(mainSource.includes('\u91cd\u65b0\u8fde\u63a5') || mainSource.includes('????'));
  assert.ok(mainSource.includes('\u6253\u5f00 OpenClaw') || mainSource.includes('?? OpenClaw'));
});

test('desktop main process starts and stops tunnel health monitoring around active connections', () => {
  assert.match(mainSource, /startTunnelHealthMonitor|scheduleTunnelHealthMonitor/);
  assert.match(mainSource, /stopTunnelHealthMonitor|clearInterval/);
  assert.match(mainSource, /checkHealth|isTunnelAlive/);
});


test('desktop main process enforces a single running instance and focuses the existing window', () => {
  assert.match(mainSource, /requestSingleInstanceLock/);
  assert.match(mainSource, /second-instance/);
  assert.match(mainSource, /showMainWindow\(\)|mainWindow\?\.focus\(\)/);
});

test('desktop main process defines an automatic reconnect retry schedule for unexpected tunnel drops', () => {
  assert.match(mainSource, /3_000|3000/);
  assert.match(mainSource, /5_000|5000/);
  assert.match(mainSource, /10_000|10000/);
  assert.match(mainSource, /scheduleReconnectAttempt|startReconnectSequence|reconnectAttempt/);
  assert.match(mainSource, /unexpected|userRequestedDisconnect|manualDisconnect/);
});

test('desktop main process records diagnostics entries for connection lifecycle events', () => {
  assert.match(mainSource, /diagnosticsLog|diagnosticEntries|appendDiagnosticsEntry|pushDiagnostic/);
  assert.match(mainSource, /listDiagnostics|clearDiagnostics|openclaw:diagnostics:list/);
});

test('desktop tray menu adds diagnostics and settings entry shortcuts for support workflows', () => {
  assert.ok(mainSource.includes('\\u6253\\u5f00\\u8bca\\u65ad') || mainSource.includes('????'));
  assert.ok(mainSource.includes('\\u6253\\u5f00\\u8bbe\\u7f6e') || mainSource.includes('????'));
});
