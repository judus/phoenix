# Running PHOENIX from source

For a normal installation, use the [Windows installer or Linux AppImage](../README.md#download).
The instructions below are for running a source checkout. You’ll need Git and Node.js 24.14+.

## Before you start

Enter your commander session in Elite at least once. Save keyboard bindings for the commands
you want PHOENIX to operate, then start PHOENIX. It reads the active `.binds` file at startup;
restart it after changing bindings. Controller-only bindings cannot be sent as keyboard input.

PHOENIX can start with Elite closed, but it can only show information the game has written to
local files. Journals are local to each computer, not a complete commander database shared
between installations. Opening Shipyard or Outfitting and entering a commander session can
provide snapshots that were missing from earlier journals.

Online searches and catalogue refreshes need internet access. Packaged builds include a starter
catalogue; PHOENIX stores refreshed catalogues in its writable user-data directory.

## Windows / PowerShell

Install Git and a supported Node.js version. With winget:

```powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
winget install --id Git.Git -e --source winget
```

Reopen PowerShell so the new commands are on `PATH`, then check the Node version and start:

```powershell
node --version
npm.cmd --version
git --version

cd $HOME
git clone https://github.com/judus/phoenix.git
cd .\phoenix
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open `http://localhost:3400`. Stop with `Ctrl+C`. To update, stop PHOENIX first, then:

```powershell
cd $HOME\phoenix
git pull --ff-only
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Using `npm.cmd` avoids PowerShell execution-policy problems without changing that policy.
Controls send your saved bindings to the active window, so keep Elite focused. PHOENIX does
not modify Elite or its game files.

## Linux

A source installation needs the keyboard helper for your desktop session:

- **X11:** `xdotool`.
- **Wayland:** `xkbcli` and an XDG RemoteDesktop portal with keyboard support.

The AppImage bundles its own helpers; these commands are for source installations. Install
both helpers if you switch between X11 and Wayland:

```sh
# Debian, Ubuntu, Linux Mint
sudo apt install xdotool libxkbcommon-tools

# Fedora
sudo dnf install xdotool libxkbcommon-utils

# Arch Linux
sudo pacman -S xdotool libxkbcommon
```

GNOME and KDE normally provide a suitable portal backend. If yours does not, install
`xdg-desktop-portal` and the backend for your desktop. On Wayland, PHOENIX asks permission
when it first sends input. If controls remain unavailable, check `controls.detail` in
`data/runtime/system.json` for missing keymap-reader or portal information.

```sh
git clone https://github.com/judus/phoenix.git
cd phoenix
npm ci
npm run build
npm start
```

Open `http://localhost:3400`. Stop with `Ctrl+C`. To update a checkout, stop PHOENIX first:

```sh
git pull --ff-only
npm ci
npm run build
npm start
```

## Copilot

Copilot is optional and is disabled without an API key. Set `PHOENIX_OPENAI_API_KEY` in the
server’s environment. It takes precedence over the fallback `OPENAI_API_KEY`.
See [`.env.example`](../.env.example) for ports, paths, models, and input options.

The same key enables public-web searches in text and realtime conversations.
`PHOENIX_OPENAI_WEB_SEARCH_MODEL` selects the search model; by default it uses
`PHOENIX_OPENAI_MODEL`. OpenAI wire logging is off by default because it can contain prompts,
responses, and tool data. Keep keys out of issues, screenshots, and Git.

For realtime voice:

1. Open `http://localhost:3400` on the computer running PHOENIX.
2. Connect voice and allow microphone access.
3. Select the microphone and output under **Voice audio**. Avoid Stereo Mix and other loopback inputs.
4. Keep the browser open and return focus to Elite. A paired tablet or spare display can control
   the voice session while you play.

Headphones help prevent Copilot responding to game audio. For practical in-game use, use an
auxiliary display to control the voice host.

PHOENIX restricts its user-state directories and files to `0700` and `0600` on POSIX systems.
On Windows, keep custom state and log paths inside your user profile with private access permissions.

## Development and installer builds

Use `npm run dev` for the live development servers and `npm run check` for tests, types, and a
production build. Start feature branches from `dev`; don’t make routine changes directly on `main`.

Installer builds are native: build Linux AppImages on Linux x64 and Windows installers on Windows
x64. The [packaging guide](../scripts/package/README.md) lists the tools, commands, and verification
steps. See [the release guide](releases.md) for CI and GitHub Releases.

An experimental [Android shell](../apps/android/README.md) can be built locally for tablet testing.
It connects to the desktop server; it does not replace the desktop installation. Android APKs are
not yet included in GitHub releases.

### Embedded Control Deck runtime

PHOENIX uses a compiled Control Deck runtime for its core, host, keyboard adapter, and Elite
integration. The versioned tarball is in `vendor/control-deck/`; you don’t need access to the
private Control Deck repository or private registry credentials to install PHOENIX.

To update the JS runtime, run `npm run package:phoenix` in the Control Deck repository, replace
the tarball, update PHOENIX’s three `control-deck` file dependencies, and run `npm install` followed
by `npm run check`. Keep standalone Control Deck UI and product exports out of this package.
The separate native Linux helper has its own [build and provenance notes](../vendor/control-deck/README.md).
