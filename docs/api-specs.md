# API Specifications for Obsidian Sync Service

## Endpoints

### POST /sync/upload
- **Description**: Upload a file to Google Drive
- **Body**: 
  - `vaultId`: string
  - `filePath`: string
  - `fileData`: binary
  - `lastModified`: timestamp
- **Response**: 
  - `fileId`: string
  - `status`: "success" | "conflict"

### GET /sync/download/:fileId
- **Description**: Download a file from Google Drive
- **Response**: Binary file data

### GET /sync/metadata/:vaultId
- **Description**: Get metadata for all files in a vault
- **Response**: Array of file metadata (id, path, lastModified)

### POST /sync/resolve-conflict
- **Description**: Resolve file conflict
- **Body**: 
  - `fileId`: string
  - `choice`: "local" | "remote"
- **Response**: Status of resolution

## Authentication
- Use OAuth 2.0 with Google Drive API
- Bearer token required for all requests