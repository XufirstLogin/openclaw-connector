# OpenClaw Connector

OpenClaw Connector is a Windows desktop client focused on **local-only OpenClaw access**, **multi-server management**, and **one-click SSH tunneling + GUI opening**.

## What it does

The current product focus is the **Windows local mode desktop client**:

- Save server configurations locally
- Manage multiple OpenClaw servers in one place
- Test connection before saving
- Create SSH local forwarding with one click
- Open OpenClaw GUI with one click
- Keep the app resident in tray to reduce accidental disconnects
- Import / export local server profiles

> Recommended use case: users who already have an OpenClaw server and want a cleaner workflow than repeatedly typing `ssh -N -L ...`.

---

## Project structure

```text
apps/desktop            Electron + React Windows desktop client
services/account-api    Optional NestJS backend (historical/cloud capability)
packages/shared-contracts Shared types and contracts
infra/docker-compose.dev.yml Local PostgreSQL for backend development
```

---

## Recommended runtime mode

For the current public version, the recommended mode is:

- **Desktop local mode** ✅

The backend (`services/account-api`) is still included in the source tree as an optional capability for account / verification / persistence experiments, but the main product direction is the standalone Windows desktop app.

---

## Environment requirements

### Desktop app

- Windows 10/11
- Node.js 20+
- npm 10+

### Optional backend

- Node.js 20+
- PostgreSQL (only if you want persistent backend mode)
- SMTP account (only if you want real email verification)

---

## Install dependencies

Run in the project root:

```bash
npm install
```

---

## Run the desktop app in development

```bash
npm run dev:desktop
```

This starts:

- Vite renderer
- Electron main/preload build watcher
- Electron app process

---

## Build the desktop app

```bash
npm run build -w @openclaw/desktop
```

This produces:

- `apps/desktop/dist-renderer`
- `apps/desktop/dist-electron`

---

## Build the Windows installer

```bash
npm run dist -w @openclaw/desktop
```

or from the workspace root:

```bash
npm run dist:desktop
```

The unsigned NSIS installer will be generated in:

```text
apps/desktop/release/
```

Typical output file:

```text
OpenClaw Connector Setup 0.1.0.exe
```

---

## Optional: run the backend API

If you also want to run the optional account API locally:

### 1. Create env file

```bash
copy services/account-api/.env.example services/account-api/.env
```

### 2. Generate Prisma client

```bash
npm run prisma:generate -w @openclaw/account-api
```

### 3. Run database migration (only when using PostgreSQL)

```bash
npm run prisma:migrate:dev -w @openclaw/account-api
```

### 4. Start backend

```bash
npm run dev:api
```

---

## SMTP notes for the backend

If you enable real email sending in the backend, configure `services/account-api/.env` with your SMTP information.

For example, a `163` mailbox typically needs:

- SMTP host
- SMTP port
- sender mailbox
- authorization code (not the web login password)

Do **not** commit your `.env` file or mailbox authorization codes.

---

## GitHub release recommendation

Recommended publishing model:

- **GitHub repository**: source code
- **GitHub Releases**: Windows installer `.exe`

Do **not** commit large installer files directly into repository history unless absolutely necessary.

---

## Current status

The current source tree already includes:

- Desktop local mode workflow
- Multi-server local profile support
- SSH tunnel management
- GUI quick open
- Import / export flow
- Tray behavior improvements
- Windows installer packaging

---

## Notes

- The installer is currently **unsigned** unless you add a Windows code signing certificate.
- If Windows SmartScreen shows a warning, that is expected for unsigned builds.
- Build artifacts such as `release/`, `dist-electron/`, and `dist-renderer/` are intentionally ignored by Git.

---

## License

Add your preferred license before publishing publicly.
