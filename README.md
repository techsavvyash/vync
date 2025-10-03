# Vync

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A complete synchronization solution for Obsidian vaults with Google Drive backend, featuring real-time sync, folder structure preservation, and automatic conflict detection.

## ✨ Features

- 🔄 **Bi-directional Sync** - Upload and download files between Obsidian and Google Drive
- 📁 **Folder Preservation** - Maintains complete directory hierarchy in Google Drive
- ⚡ **Real-time Updates** - Files sync immediately on creation or modification
- 🔐 **OAuth 2.0 Auth** - Secure Google Drive authentication
- 🌐 **Remote Deployment** - Works on any hosting platform with auto-detected URLs
- 🔍 **Index Reconciliation** - Periodic scanning ensures all files are tracked
- 💾 **Local Storage** - Development mode with local file storage
- 🚀 **Auto-Detection** - Dynamic configuration for any environment

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd vync
bun install
```

### 2. Setup Server
```bash
cd packages/server
cp .env.example .env
# Edit .env with your configuration
bun run dev
```

### 3. Setup Obsidian Plugin
```bash
cd packages/plugin
bun run build
# Install plugin in Obsidian
```

**📖 Detailed guide:** See [QUICK_START.md](QUICK_START.md)

## 📋 Documentation

### Getting Started
- **[Quick Start Guide](QUICK_START.md)** - Get running in 10 minutes
- **[Environment Setup](packages/server/ENV_SETUP_GUIDE.md)** - Configure environment variables
- **[Deployment Guide](DEPLOYMENT_GUIDE.md)** - Deploy to production

### Features
- **[Folder Sync](FOLDER_SYNC_DOCUMENTATION.md)** - Folder structure preservation
- **[OAuth Setup](OAUTH_REDIRECT_FIX.md)** - Dynamic OAuth configuration
- **[Binary Files](PDF_UPLOAD_FIX.md)** - PDF and image upload support

### Reference
- **[Environment Variables](ENVIRONMENT_VARIABLES.md)** - All configuration options
- **[Server API](packages/server/README.md)** - Server documentation
- **[Changelog](CHANGELOG.md)** - Version history
- **[Summary](SUMMARY.md)** - Project overview

## 🏗️ Architecture

```
vync/
├── packages/
│   ├── server/          # Backend sync server
│   │   ├── src/
│   │   │   ├── routes/  # API endpoints
│   │   │   └── services/# Drive services
│   │   └── .env         # Configuration
│   │
│   └── plugin/          # Obsidian plugin
│       ├── src/
│       │   ├── services/# Sync services
│       │   └── main.ts  # Plugin entry
│       └── manifest.json
│
└── docs/               # Documentation
```

## 🔧 Configuration

### Server (.env)
```bash
# Storage backend
DRIVE_TYPE=google  # 'local' or 'google'

# Google OAuth (if using Google Drive)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Optional - auto-detected if not set
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
```

### Obsidian Plugin
```
Settings → Vync:
- Server URL: http://localhost:3000
- Vault ID: my-vault
- Auto Sync: ON
```

## 🌐 Deployment

### Supported Platforms
- ✅ Vercel (Serverless)
- ✅ Railway (Container)
- ✅ Render (Web Service)
- ✅ Docker (Container)
- ✅ VPS (PM2)

### Quick Deploy
```bash
# Vercel
vercel deploy

# Railway
railway up

# Docker
docker build -t vync .
docker run -p 3000:3000 vync
```

**📖 Full guide:** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

## 📊 How It Works

### Sync Flow
1. **File Created** in Obsidian
2. **Plugin Detects** change via VaultWatcher
3. **Immediate Upload** to server
4. **Server Uploads** to Google Drive
5. **Index Updated** with file metadata
6. **Folder Structure** created automatically

### Index Reconciliation
- Runs every 5 minutes automatically
- Detects files created outside Obsidian
- Ensures vault and index parity
- Manual trigger via command palette

### Conflict Resolution
- Automatic detection of conflicts
- User-prompted resolution
- Preserves both versions
- Tracks conflict history

## 🔐 Security

### Best Practices
- ✅ HTTPS in production
- ✅ Environment-specific credentials
- ✅ Restricted CORS origins
- ✅ Sensitive files in .gitignore
- ✅ OAuth token encryption

### Protected Files
```
.env
.env.production
oauth-tokens.json
credentials.json
```

## 🧪 Testing

### Manual Tests
```bash
# Test file sync
1. Create file in Obsidian
2. Check console for upload
3. Verify in Google Drive

# Test folder sync
1. Create nested folders
2. Add files to folders
3. Check Drive structure

# Test OAuth
1. Visit /auth/google
2. Complete flow
3. Check /auth/status
```

### Commands
```bash
# Server health
curl http://localhost:3000/health

# Auth status
curl http://localhost:3000/auth/status

# Plugin commands (in Obsidian)
- "Sync Vault"
- "Reconcile Sync Index"
- "Test Connection"
```

## 🐛 Troubleshooting

### Common Issues

**Server won't start**
```bash
# Check port availability
lsof -i :3000
# Use different port
PORT=8080 bun run dev
```

**OAuth errors**
```bash
# Add redirect URI to Google Console
http://localhost:3000/auth/google/callback
```

**Files not syncing**
```bash
# Run index reconciliation
Cmd/Ctrl + P → "Reconcile Sync Index"
```

**📖 More solutions:** See documentation links above

## 📈 Roadmap

### v1.1 (Short Term)
- [ ] File deletion from Google Drive
- [ ] Chunked large file uploads
- [ ] Selective sync patterns

### v1.2 (Medium Term)
- [ ] Real-time collaboration
- [ ] Mobile app support
- [ ] Alternative storage backends

### v2.0 (Long Term)
- [ ] End-to-end encryption
- [ ] Multi-user support
- [ ] Advanced conflict resolution

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Update documentation
6. Submit PR

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 🙏 Acknowledgments

Built with:
- [Bun](https://bun.sh/) - Fast JavaScript runtime
- [Elysia](https://elysiajs.com/) - Web framework
- [Google Drive API](https://developers.google.com/drive) - Storage
- [Obsidian API](https://docs.obsidian.md/) - Plugin platform

## 💬 Support

- **Documentation**: See links above
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions

## ⭐ Star History

If this project helps you, consider giving it a star!

---

**Status**: Production Ready ✅
**Version**: 1.0.0
**Last Updated**: 2024

[Quick Start](QUICK_START.md) | [Documentation](SUMMARY.md) | [Deployment](DEPLOYMENT_GUIDE.md) | [Contributing](#contributing)