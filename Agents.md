# Agents.md for Obsidian Sync Service

This document provides context for future sessions of the AI agent working on the Obsidian sync service project.

## Project Overview
- **Goal**: Build a custom sync service for Obsidian using Google Drive as blob storage to avoid paid sync costs.
- **Key Features**:
  - Multi-vault support
  - Complete file syncing (text, PDFs, images, videos)
  - Automatic change detection
  - Conflict resolution (latest file or user choice)
- **Architecture**:
  - Bun server with Elysia.js for API and Google Drive integration
  - Obsidian plugin for change detection and syncing
  - Mono-repo structure with packages for server and plugin

## Current State
- Repository is initialized as empty
- Basic structure and documentation being set up
- Next steps: Implement server, plugin, and integration logic

## Important Notes
- Use Google Drive API for file operations
- Ensure secure handling of authentication and file metadata
- Test conflict resolution thoroughly
- Follow mono-repo best practices for package management

## Commands to Run
- Lint: `npm run lint` (if applicable)
- Typecheck: `npm run typecheck` (if applicable)
- Build: `bun run build` for server, plugin-specific commands as developed