#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { argv, exit } from 'process';

interface GithubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

const REPO_OWNER = 'techsavvyash';
const REPO_NAME = 'vync';
const REQUIRED_FILES = ['main.js', 'manifest.json', 'styles.css'];

async function fetchLatestRelease(): Promise<GithubRelease> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'vync-installer'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch latest release: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch latest release: ${error}`);
  }
}

async function downloadFile(url: string): Promise<string> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    throw new Error(`Failed to download file: ${error}`);
  }
}

async function installPlugin(vaultPath: string): Promise<void> {
  console.log('🔍 Fetching latest Vync release...');

  // Fetch latest release
  const release = await fetchLatestRelease();
  console.log(`✅ Found latest release: ${release.tag_name}`);

  // Create plugin directory
  const pluginDir = join(vaultPath, '.obsidian', 'plugins', 'vync');

  if (!existsSync(pluginDir)) {
    console.log(`📁 Creating plugin directory: ${pluginDir}`);
    mkdirSync(pluginDir, { recursive: true });
  }

  // Download and install required files
  for (const fileName of REQUIRED_FILES) {
    const asset = release.assets.find(a => a.name === fileName);

    if (!asset) {
      throw new Error(`Required file '${fileName}' not found in release ${release.tag_name}`);
    }

    console.log(`⬇️  Downloading ${fileName}...`);
    const content = await downloadFile(asset.browser_download_url);

    const filePath = join(pluginDir, fileName);
    writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Installed ${fileName}`);
  }

  console.log('\n🎉 Vync plugin installed successfully!');
  console.log('\nNext steps:');
  console.log('1. Open Obsidian');
  console.log('2. Go to Settings → Community Plugins');
  console.log('3. Enable "Vync"');
  console.log('4. Configure your Google Drive credentials');
}

function printUsage(): void {
  console.log(`
Vync Installer - Install Vync Obsidian plugin from latest release

Usage:
  npx @techsavvyash/vync-installer <vault-path>
  bunx @techsavvyash/vync-installer <vault-path>

Arguments:
  <vault-path>    Path to your Obsidian vault directory

Examples:
  npx @techsavvyash/vync-installer ~/Documents/MyVault
  bunx @techsavvyash/vync-installer "C:\\Users\\YourName\\Documents\\MyVault"

The installer will:
  - Fetch the latest release from GitHub
  - Download main.js, manifest.json, and styles.css
  - Install them to <vault-path>/.obsidian/plugins/vync/
  `);
}

async function main(): Promise<void> {
  // Parse arguments (skip first two: node and script path)
  const args = argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    exit(args.length === 0 ? 1 : 0);
  }

  const vaultPath = args[0];

  // Validate vault path
  if (!existsSync(vaultPath)) {
    console.error(`❌ Error: Vault path does not exist: ${vaultPath}`);
    exit(1);
  }

  const obsidianDir = join(vaultPath, '.obsidian');
  if (!existsSync(obsidianDir)) {
    console.error(`❌ Error: Not a valid Obsidian vault. .obsidian directory not found in: ${vaultPath}`);
    console.error('   Make sure you provide the path to your vault root directory.');
    exit(1);
  }

  try {
    await installPlugin(vaultPath);
    exit(0);
  } catch (error) {
    console.error(`\n❌ Installation failed: ${error}`);
    exit(1);
  }
}

main();
