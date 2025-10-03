# Obsidian Sync Server
**This is not needed anymore, I have kept it here for documentation purposes (and for reference in extending future use-cases) ** 
Backend server for syncing Obsidian vaults to Google Drive with real-time conflict detection and folder structure preservation.

## Features

- 🔄 **Bi-directional Sync**: Upload and download files between Obsidian and Google Drive
- 📁 **Folder Structure Preservation**: Maintains complete directory hierarchy
- 🔐 **OAuth 2.0 Authentication**: Secure Google Drive access
- 🚀 **Auto-Detection**: Dynamic redirect URI detection for any deployment
- ⚡ **Real-time Sync**: Immediate file upload on creation/modification
- 🔍 **Conflict Detection**: Automatic conflict resolution
- 📊 **Index Reconciliation**: Ensures all files are tracked and synced
- 🌐 **CORS Support**: Works with Obsidian desktop app

## Quick Start

### 1. Install Dependencies
```bash
bun install
```

### 2. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your settings
# For local development:
DRIVE_TYPE=local

# For Google Drive:
DRIVE_TYPE=google
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 3. Start Server
```bash
# Development
bun run dev

# Production
bun run start
```

### 4. Authenticate (Google Drive only)
```bash
# Visit in browser
http://localhost:3000/auth/google

# Complete OAuth flow
# Tokens saved to oauth-tokens.json
```

## Configuration

### Environment Variables

See [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md) for detailed configuration instructions.

**Quick Reference:**
```bash
# Storage Backend
DRIVE_TYPE=google              # 'local' or 'google'

# Google OAuth (required for DRIVE_TYPE=google)
GOOGLE_CLIENT_ID=xxx          # From Google Cloud Console
GOOGLE_CLIENT_SECRET=xxx      # From Google Cloud Console
GOOGLE_REDIRECT_URI=xxx       # Optional - auto-detected if not set

# Server Settings
PORT=3000                     # Server port
NODE_ENV=development          # Environment
```

### OAuth Redirect URI

The server **auto-detects** the redirect URI from incoming requests:
- Development: `http://localhost:3000/auth/google/callback`
- Production: `https://your-domain.com/auth/google/callback`

You can override by setting `GOOGLE_REDIRECT_URI` in `.env`

**Important:** Add redirect URIs to [Google Cloud Console](https://console.cloud.google.com)

## API Endpoints

### Authentication
- `GET /auth/google` - Start OAuth flow
- `GET /auth/google/callback` - OAuth callback
- `GET /auth/status` - Check authentication status

### Sync
- `POST /sync/upload` - Upload file to Google Drive
- `GET /sync/download/:fileId` - Download file from Google Drive
- `POST /sync/delta` - Get sync delta (files to upload/download)
- `GET /sync/metadata` - Get vault metadata
- `POST /sync/conflict/resolve` - Resolve sync conflict

### Health
- `GET /` - Server status
- `GET /health` - Detailed health check

## Project Structure

```
packages/server/
├── src/
│   ├── index.ts                 # Server entry point
│   ├── routes/
│   │   ├── auth.ts             # Authentication routes
│   │   └── sync.ts             # Sync routes
│   └── services/
│       ├── drive/              # Drive service implementations
│       │   ├── GoogleDriveService.ts
│       │   ├── LocalDriveService.ts
│       │   └── DriveServiceFactory.ts
│       ├── fileWatcher.ts      # File change detection
│       └── conflictDetector.ts # Conflict resolution
├── .env                        # Environment config (not committed)
├── .env.example                # Example environment config
└── oauth-tokens.json           # OAuth tokens (not committed)
```

## Development

### Run Tests
```bash
bun test
```

### Build
```bash
bun run build
```

### Debug Mode
```bash
DEBUG=true bun run dev
```

### Watch Mode
```bash
bun run dev  # Auto-reloads on file changes
```

## Deployment

See [DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE.md) for platform-specific deployment instructions.

### Quick Deploy Options

**Vercel:**
```bash
vercel deploy
```

**Railway:**
```bash
railway up
```

**Docker:**
```bash
docker build -t obsidian-sync .
docker run -p 3000:3000 obsidian-sync
```

**VPS:**
```bash
pm2 start "bun run start" --name obsidian-sync
```

## Google Cloud Setup

### 1. Create Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project
3. Enable Google Drive API

### 2. Create OAuth Credentials
1. Navigate to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Choose "Web application"
4. Add redirect URIs:
   - `http://localhost:3000/auth/google/callback` (development)
   - `https://your-domain.com/auth/google/callback` (production)

### 3. Configure Environment
```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Troubleshooting

### Common Issues

**OAuth Error: redirect_uri_mismatch**
- Add the exact redirect URI to Google Cloud Console
- Check console logs for the actual URI being used
- Ensure protocol (http/https) matches

**Server not starting**
- Check `.env` file exists and is configured
- Verify port 3000 is available
- Check for syntax errors in environment variables

**Files not syncing**
- Verify authentication: `curl http://localhost:3000/auth/status`
- Check Google Drive API is enabled
- Review server logs for errors

**Tokens not persisting**
- Check file permissions for `oauth-tokens.json`
- Ensure server has write access
- For Docker, use volume mounts

### Debug Tools

**Check Server Status:**
```bash
curl http://localhost:3000/health
```

**Check Authentication:**
```bash
curl http://localhost:3000/auth/status
```

**View Logs:**
```bash
# Development
bun run dev

# Production (PM2)
pm2 logs obsidian-sync
```

## Security

### Best Practices
1. ✅ Use HTTPS in production
2. ✅ Never commit `.env` or `oauth-tokens.json`
3. ✅ Rotate OAuth credentials regularly
4. ✅ Restrict CORS origins in production
5. ✅ Use separate OAuth clients per environment

### Environment Files to Ignore
```gitignore
.env
oauth-tokens.json
credentials.json
local-storage/
```

## Documentation

- [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md) - Environment configuration
- [DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE.md) - Deployment instructions
- [OAUTH_REDIRECT_FIX.md](../../OAUTH_REDIRECT_FIX.md) - OAuth redirect URI details
- [FOLDER_SYNC_DOCUMENTATION.md](../../FOLDER_SYNC_DOCUMENTATION.md) - Folder sync features
- [PDF_UPLOAD_FIX.md](../../PDF_UPLOAD_FIX.md) - Binary file upload fix

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Elysia](https://elysiajs.com/)
- **Storage**: Google Drive API
- **Auth**: OAuth 2.0

## License

MIT

## Support

For issues and questions:
- Check [Troubleshooting](#troubleshooting) section
- Review [Documentation](#documentation)
- Open an issue on GitHub