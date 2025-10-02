# Drive Service Implementation

## Overview

This implementation provides a flexible, abstracted drive service that can work with either Google Drive or local file system storage. The system is designed to be:

- **Environment-driven**: Automatically chooses the appropriate service based on configuration
- **CI/CD friendly**: Can run tests without external dependencies
- **Production ready**: Supports real Google Drive integration
- **Type-safe**: Full TypeScript support with consistent interfaces

## Architecture

### Core Components

#### 1. Interface (`IDriveService.ts`)
```typescript
interface IDriveService {
  testConnection(): Promise<{ connected: boolean; message: string }>
  uploadFile(fileName, fileData, mimeType, folderId?): Promise<UploadResult>
  downloadFile(fileId): Promise<DownloadResult>
  listFiles(folderId?): Promise<ListResult>
  deleteFile(fileId): Promise<DeleteResult>
  getFileMetadata(fileId): Promise<{ success: boolean; file?: DriveFile; error?: string }>
  isAuthenticated(): boolean
  getServiceType(): string
}
```

#### 2. Google Drive Implementation (`GoogleDriveService.ts`)
- Real Google Drive API integration
- Requires `credentials.json` for authentication
- Full Google Drive feature support
- Handles OAuth2 and service account authentication

#### 3. Local File System Implementation (`LocalDriveService.ts`)
- Stores files in local directory structure
- No external dependencies required
- Perfect for testing and development
- Maintains file metadata in JSON index

#### 4. Factory Pattern (`DriveServiceFactory.ts`)
- Environment-based service selection
- Singleton pattern for service instances
- Auto-detection of available services
- Configuration management

## Configuration

### Environment Variables

```bash
# Explicit service selection
DRIVE_TYPE=google|local

# Google Drive credentials
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Local storage configuration
LOCAL_STORAGE_PATH=./local-storage
```

### Auto-Detection Logic

1. **Explicit Configuration**: Uses `DRIVE_TYPE` if set
2. **Google Drive Detection**: Checks for credentials files or environment variables
3. **Default Fallback**: Uses local storage if no Google Drive credentials found

## Usage Examples

### Basic Usage

```typescript
import { DriveServiceFactory } from './services/drive/DriveServiceFactory'

// Get the configured drive service
const driveService = DriveServiceFactory.getDriveService()

// Test connection
const connection = await driveService.testConnection()
if (connection.connected) {
  console.log('Drive service ready:', connection.message)
}

// Upload a file
const uploadResult = await driveService.uploadFile(
  'document.md',
  Buffer.from('# Hello World'),
  'text/markdown'
)

if (uploadResult.success) {
  console.log('File uploaded with ID:', uploadResult.fileId)
}
```

### Service Information

```typescript
import { DriveServiceFactory } from './services/drive/DriveServiceFactory'

const info = DriveServiceFactory.getServiceInfo()
console.log('Current service:', info.serviceType)
console.log('Authenticated:', info.isAuthenticated)
console.log('Drive type:', info.type)
```

### Testing with Different Services

```typescript
// Force local storage for testing
process.env.DRIVE_TYPE = 'local'
DriveServiceFactory.resetInstance()
const localService = DriveServiceFactory.getDriveService()

// Force Google Drive for production
process.env.DRIVE_TYPE = 'google'
DriveServiceFactory.resetInstance()
const googleService = DriveServiceFactory.getDriveService()
```

## Testing Strategy

### CI/CD Compatibility

The implementation is designed to run in CI/CD environments without external dependencies:

```bash
# CI will automatically use local storage
npm test

# Or explicitly set local storage
DRIVE_TYPE=local npm test
```

### Test Coverage

**23 comprehensive tests** covering:

#### LocalDriveService Tests ✅
- Service initialization and connection testing
- File upload/download operations
- File listing and metadata retrieval
- File deletion and error handling
- Folder support and organization

#### GoogleDriveService Tests ✅
- Service initialization
- Authentication handling
- Error responses without credentials
- Interface compliance

#### DriveServiceFactory Tests ✅
- Environment variable parsing
- Service selection logic
- Singleton pattern behavior
- Auto-detection functionality

#### Cross-Service Compatibility Tests ✅
- Interface consistency verification
- Result structure validation
- Common functionality testing

#### CI/CD Compatibility Tests ✅
- Credential-free operation
- Local storage reliability
- Isolated testing capability

### Running Tests

```bash
# Run all drive service tests
cd packages/server
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx jest tests/driveServices.test.ts

# Run in watch mode
npx jest --watch
```

## File Structure

```
packages/server/
├── src/
│   └── services/
│       └── drive/
│           ├── IDriveService.ts          # Core interface
│           ├── GoogleDriveService.ts     # Google Drive implementation
│           ├── LocalDriveService.ts      # Local storage implementation
│           └── DriveServiceFactory.ts    # Service factory
└── tests/
    ├── setup.ts                          # Test environment setup
    ├── driveServices.test.ts            # Comprehensive test suite
    └── jest.config.js                    # Jest configuration
```

## Implementation Details

### LocalDriveService Features

- **Storage Structure**: Files stored as `{fileId}_{originalName}`
- **Metadata Index**: JSON file tracking all files and metadata
- **Folder Support**: Hierarchical storage using subdirectories
- **MIME Type Detection**: Automatic content type detection
- **File ID Generation**: UUID-based unique identifiers

### GoogleDriveService Features

- **Authentication**: Service account and OAuth2 support
- **File Operations**: Full CRUD operations with Google Drive API
- **Metadata Handling**: Preserves all Google Drive metadata
- **Folder Organization**: Supports Google Drive folder structure
- **Error Handling**: Comprehensive error reporting

### Factory Pattern Benefits

- **Single Responsibility**: Factory handles service selection
- **Environment Awareness**: Adapts to different deployment environments
- **Testing Support**: Easy service mocking and replacement
- **Performance**: Singleton pattern prevents unnecessary recreations

## Error Handling

### Common Error Scenarios

1. **Google Drive Authentication Failed**
   ```typescript
   const result = await driveService.testConnection()
   if (!result.connected) {
     console.log('Google Drive not available:', result.message)
     // Fall back to local storage or show user message
   }
   ```

2. **File Not Found**
   ```typescript
   const downloadResult = await driveService.downloadFile('missing-id')
   if (!downloadResult.success) {
     console.log('File not found:', downloadResult.error)
   }
   ```

3. **Storage Quota Exceeded**
   ```typescript
   const uploadResult = await driveService.uploadFile('large-file.dat', data, 'application/octet-stream')
   if (!uploadResult.success) {
     console.log('Upload failed:', uploadResult.error)
   }
   ```

## Performance Considerations

### LocalDriveService
- **Fast Operations**: Direct file system access
- **Memory Efficient**: Streams large files
- **Index Management**: JSON-based metadata for quick lookups

### GoogleDriveService
- **Network Latency**: API calls have network overhead
- **Rate Limiting**: Subject to Google Drive API quotas
- **Caching**: Consider implementing local caching for frequently accessed files

## Security Considerations

### LocalDriveService
- **File Permissions**: Ensure proper file system permissions
- **Path Traversal**: Validate file paths to prevent directory traversal attacks
- **Storage Limits**: Monitor disk space usage

### GoogleDriveService
- **Credential Security**: Store credentials securely (environment variables, secret management)
- **Access Control**: Use appropriate OAuth scopes
- **Data Privacy**: Ensure proper data handling and compliance

## Migration and Compatibility

### Switching Between Services

```typescript
// Switch to local storage
process.env.DRIVE_TYPE = 'local'
DriveServiceFactory.resetInstance()
const localService = DriveServiceFactory.getDriveService()

// Switch to Google Drive
process.env.DRIVE_TYPE = 'google'
DriveServiceFactory.resetInstance()
const googleService = DriveServiceFactory.getDriveService()
```

### Data Migration

The services use different file ID formats:
- **LocalDriveService**: UUID-based IDs
- **GoogleDriveService**: Google Drive file IDs

Consider implementing a migration utility if switching between services with existing data.

## Future Enhancements

### Potential Improvements

1. **Caching Layer**: Add Redis/local caching for frequently accessed files
2. **Compression**: Implement file compression for storage efficiency
3. **Encryption**: Add client-side encryption for sensitive files
4. **Progress Tracking**: Add upload/download progress callbacks
5. **Batch Operations**: Support bulk file operations
6. **Sync Optimization**: Implement incremental sync capabilities

### Additional Drive Services

The architecture supports adding new drive services:
- Dropbox integration
- OneDrive integration
- AWS S3 integration
- FTP/SFTP support

Each new service would implement the `IDriveService` interface.

## Troubleshooting

### Common Issues

1. **Service Not Found**
   - Check `DRIVE_TYPE` environment variable
   - Verify credentials for Google Drive
   - Ensure local storage directory is writable

2. **Authentication Errors**
   - Validate Google Drive credentials format
   - Check OAuth2 token expiration
   - Verify service account permissions

3. **File Operation Failures**
   - Check available disk space (local storage)
   - Verify API quotas (Google Drive)
   - Validate file paths and permissions

### Debug Mode

Enable detailed logging:

```typescript
// Enable console logging in tests
console.log = originalConsole.log
console.error = originalConsole.error
```

## Contributing

When adding new drive services:

1. Implement the `IDriveService` interface
2. Add comprehensive tests
3. Update the factory's service selection logic
4. Document any new environment variables
5. Ensure CI/CD compatibility

---

**Test Status**: ✅ All 23 tests passing
**CI/CD Ready**: ✅ No external dependencies required
**Production Ready**: ✅ Full Google Drive integration
**Development Ready**: ✅ Local storage for testing