# Research Outline for Obsidian Sync Service

## Google Drive API
- **Key Features**: File upload/download, metadata management, OAuth authentication
- **Limitations**: Rate limits, file size restrictions
- **Integration**: Use googleapis library for Node.js

## Elysia.js
- **Pros**: Fast, lightweight, good for APIs
- **Setup**: Bun runtime, TypeScript support
- **Best Practices**: Middleware for auth, error handling

## Obsidian Plugin Development
- **API**: Use Obsidian's plugin API for file watching
- **Change Detection**: Monitor vault changes using fs events
- **Mobile Support**: Ensure compatibility with iOS Obsidian

## Conflict Resolution
- **Strategies**: Timestamp-based, user choice for recent changes
- **Implementation**: Compare lastModified times, prompt user via plugin UI

## Mono-repo Management
- **Tools**: Bun workspaces, shared dependencies
- **Structure**: Separate packages for server and plugin
- **CI/CD**: GitHub Actions for build and test