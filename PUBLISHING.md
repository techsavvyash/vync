# Publishing Guide

This guide covers how to publish releases of the Vync plugin and the installer package.

## Table of Contents

- [Publishing the Plugin](#publishing-the-plugin)
- [Publishing the Installer to NPM](#publishing-the-installer-to-npm)
- [First-Time Setup](#first-time-setup)

## Publishing the Plugin

### Automatic Release (via GitHub Actions)

1. **Create a release branch** with the version number:
   ```bash
   git checkout -b release/v1.0.0
   git push origin release/v1.0.0
   ```

2. **GitHub Actions will automatically**:
   - Run tests to ensure everything works
   - Build the plugin (`main.js`, `manifest.json`, `styles.css`)
   - Create a Git tag for the version
   - Create a GitHub release with the built files attached
   - Update version numbers in `package.json` and `manifest.json`

3. **Review and publish the release**:
   - Go to [Releases](https://github.com/techsavvyash/vync/releases)
   - Find the draft release
   - Edit release notes if needed
   - Click "Publish release"

### Manual Release (if needed)

```bash
# Build the plugin
cd packages/plugin
bun install
bun test
bun run build

# Create and push tag
git tag v1.0.0
git push origin v1.0.0

# Create GitHub release manually with main.js, manifest.json, styles.css
```

## Publishing the Installer to NPM

The installer package (`@techsavvyash/vync-installer`) allows users to install the plugin via `npx` or `bunx`.

### Prerequisites (First-Time Only)

1. **Create NPM Account**: Sign up at [npmjs.com](https://www.npmjs.com/)

2. **Generate NPM Token**:
   - Log in to npmjs.com
   - Go to Account Settings → Access Tokens
   - Click "Generate New Token" → Select "Automation"
   - Copy the token (starts with `npm_...`)

3. **Add Token to GitHub Secrets**:
   - Go to your repository on GitHub
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your token
   - Click "Add secret"

4. **Setup GitHub Actions Workflow** (First-Time Only):
   - Copy `packages/installer/publish-installer.yaml.template` to `.github/workflows/publish-installer.yaml`
   - This step must be done manually by a repository owner due to workflow permissions
   ```bash
   cp packages/installer/publish-installer.yaml.template .github/workflows/publish-installer.yaml
   git add .github/workflows/publish-installer.yaml
   git commit -m "chore: add installer publishing workflow"
   git push
   ```

### Publishing via GitHub Actions (Recommended)

1. **Navigate to Actions**:
   - Go to your repository's Actions tab
   - Select "Publish Installer to NPM" workflow

2. **Run the workflow**:
   - Click "Run workflow"
   - Select the branch (usually `main`)
   - Enter the version number (e.g., `0.0.3`)
   - Click "Run workflow"

3. **Wait for completion**:
   - The workflow will:
     - Update `packages/installer/package.json` with the new version
     - Build the installer
     - Publish to NPM
     - Commit the version bump back to the repository

4. **Verify publication**:
   - Check [npmjs.com/package/@techsavvyash/vync-installer](https://www.npmjs.com/package/@techsavvyash/vync-installer)
   - Test installation: `npx @techsavvyash/vync-installer@latest --help`

### Manual Publishing

If you prefer to publish manually or need to troubleshoot:

```bash
# Navigate to the installer package
cd packages/installer

# Install dependencies (first time only)
bun install

# Update version number
npm version 0.0.3

# Build the installer
bun run build

# Login to NPM (first time only)
npm login

# Publish to NPM
npm publish --access public

# Commit version bump
git add package.json
git commit -m "chore: bump installer version to 0.0.3"
git push
```

### Verifying the Published Package

After publishing, verify that users can install it:

```bash
# Test with npx
npx @techsavvyash/vync-installer --help

# Test with bunx
bunx @techsavvyash/vync-installer --help
```

## First-Time Setup

### For Plugin Distribution

The plugin repository already has GitHub Actions set up. No additional configuration needed.

### For NPM Publishing

Follow the [Prerequisites](#prerequisites-first-time-only) section above to set up NPM token.

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** version (1.0.0): Breaking changes
- **MINOR** version (0.1.0): New features, backwards-compatible
- **PATCH** version (0.0.1): Bug fixes, backwards-compatible

### Keeping Versions in Sync

The installer version should generally match the plugin version, but it's not strictly required:

- When releasing a new plugin version: Create a plugin release first
- Then publish the installer with the same version number
- The installer will always fetch the latest plugin release

## Troubleshooting

### NPM Publish Fails with "403 Forbidden"

- Check that your `NPM_TOKEN` secret is set correctly
- Verify the token has "Automation" or "Publish" permissions
- Make sure the package name `@techsavvyash/vync-installer` is available

### GitHub Actions Workflow Fails

- Check the Actions logs for specific errors
- Verify all secrets are set correctly
- Ensure the workflow file syntax is correct

### Users Can't Install via npx

- Wait a few minutes after publishing (NPM propagation)
- Check the package exists: https://www.npmjs.com/package/@techsavvyash/vync-installer
- Verify the `bin` field in `package.json` is correct
- Ensure the built file has execute permissions

## Release Checklist

### Plugin Release

- [ ] Update CHANGELOG.md
- [ ] Run tests: `cd packages/plugin && bun test`
- [ ] Create release branch: `git checkout -b release/vX.Y.Z`
- [ ] Push branch: `git push origin release/vX.Y.Z`
- [ ] Wait for GitHub Actions to complete
- [ ] Publish the draft release on GitHub

### Installer Release

- [ ] Ensure NPM_TOKEN is set in GitHub Secrets
- [ ] Go to Actions → "Publish Installer to NPM"
- [ ] Run workflow with version number
- [ ] Wait for workflow completion
- [ ] Verify on npmjs.com
- [ ] Test: `npx @techsavvyash/vync-installer --help`

## Additional Resources

- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Obsidian Plugin Publishing](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
