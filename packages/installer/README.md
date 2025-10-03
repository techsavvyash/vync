# Vync Installer

CLI tool to install the Vync Obsidian plugin from the latest GitHub release.

## Usage

### Using npx (recommended)

```bash
npx @techsavvyash/vync-installer <vault-path>
```

### Using bunx

```bash
bunx @techsavvyash/vync-installer <vault-path>
```

## Examples

```bash
# Linux/macOS
npx @techsavvyash/vync-installer ~/Documents/MyVault

# Windows
npx @techsavvyash/vync-installer "C:\Users\YourName\Documents\MyVault"
```

## What it does

The installer will:

1. Fetch the latest release from the [Vync GitHub repository](https://github.com/techsavvyash/vync)
2. Download `main.js`, `manifest.json`, and `styles.css`
3. Install them to `<vault-path>/.obsidian/plugins/vync/`

## After Installation

1. Open Obsidian
2. Go to Settings → Community Plugins
3. Enable "Vync"
4. Configure your Google Drive credentials

## Requirements

- Node.js 18+ or Bun
- A valid Obsidian vault (must contain `.obsidian` directory)

## Troubleshooting

**Error: Vault path does not exist**
- Make sure you provide the correct path to your vault directory

**Error: Not a valid Obsidian vault**
- The provided path must be the root directory of your vault
- It should contain a `.obsidian` folder

**Error: Required file not found in release**
- The latest release might not have all required files
- Check the [releases page](https://github.com/techsavvyash/vync/releases)

## Development

To build the installer locally:

```bash
cd packages/installer
bun install
bun run build
```

To test locally:

```bash
node dist/index.js /path/to/vault
```

## Publishing

This package is published to npm. To publish a new version:

1. Update version in `package.json`
2. Run `npm publish --access public`

Or use the automated GitHub Actions workflow (see main README).

## License

MIT
