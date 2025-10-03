var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// src/main.ts
var exports_main = {};
__export(exports_main, {
  default: () => ObsidianSyncPlugin
});
module.exports = __toCommonJS(exports_main);
var import_obsidian6 = require("obsidian");

// src/services/vaultWatcher.ts
var import_obsidian = require("obsidian");

class VaultWatcherService {
  vault;
  changeCallbacks = [];
  isWatching = false;
  eventRefs = [];
  constructor(vault) {
    this.vault = vault;
  }
  async startWatching() {
    if (this.isWatching)
      return;
    this.isWatching = true;
    console.log("Starting vault watcher using Obsidian API");
    const createRef = this.vault.on("create", (file) => {
      if (file instanceof import_obsidian.TFile && this.isRelevantFile(file.name)) {
        this.notifyChange({
          filePath: file.path,
          changeType: "created",
          timestamp: Date.now(),
          size: file.stat.size,
          isFolder: false
        });
      } else if (file instanceof import_obsidian.TFolder) {
        this.notifyChange({
          filePath: file.path,
          changeType: "created",
          timestamp: Date.now(),
          isFolder: true
        });
      }
    });
    this.eventRefs.push(createRef);
    const modifyRef = this.vault.on("modify", (file) => {
      if (file instanceof import_obsidian.TFile && this.isRelevantFile(file.name)) {
        this.notifyChange({
          filePath: file.path,
          changeType: "modified",
          timestamp: Date.now(),
          size: file.stat.size
        });
      }
    });
    this.eventRefs.push(modifyRef);
    const deleteRef = this.vault.on("delete", (file) => {
      if (file instanceof import_obsidian.TFile && this.isRelevantFile(file.name)) {
        this.notifyChange({
          filePath: file.path,
          changeType: "deleted",
          timestamp: Date.now(),
          isFolder: false
        });
      } else if (file instanceof import_obsidian.TFolder) {
        this.notifyChange({
          filePath: file.path,
          changeType: "deleted",
          timestamp: Date.now(),
          isFolder: true
        });
      }
    });
    this.eventRefs.push(deleteRef);
    const renameRef = this.vault.on("rename", (file, oldPath) => {
      if (file instanceof import_obsidian.TFile && this.isRelevantFile(file.name)) {
        this.notifyChange({
          filePath: oldPath,
          changeType: "deleted",
          timestamp: Date.now(),
          isFolder: false,
          oldPath
        });
        this.notifyChange({
          filePath: file.path,
          changeType: "created",
          timestamp: Date.now(),
          size: file.stat.size,
          isFolder: false,
          oldPath
        });
      } else if (file instanceof import_obsidian.TFolder) {
        console.log(`\uD83D\uDCC1 Folder renamed: ${oldPath} → ${file.path}`);
        this.notifyChange({
          filePath: file.path,
          changeType: "created",
          timestamp: Date.now(),
          isFolder: true,
          oldPath
        });
      }
    });
    this.eventRefs.push(renameRef);
    console.log("Vault watcher started successfully");
  }
  stopWatching() {
    for (const ref of this.eventRefs) {
      this.vault.offref(ref);
    }
    this.eventRefs = [];
    this.isWatching = false;
    console.log("Vault watcher stopped");
  }
  onChange(callback) {
    this.changeCallbacks.push(callback);
  }
  notifyChange(change) {
    for (const callback of this.changeCallbacks) {
      try {
        callback(change);
      } catch (error) {
        console.error("Error in change callback:", error);
      }
    }
  }
  isRelevantFile(fileName) {
    const relevantExtensions = [".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg"];
    const extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    return relevantExtensions.includes(extension);
  }
  getWatchedFileCount() {
    const files = this.vault.getFiles();
    return files.filter((f) => this.isRelevantFile(f.name)).length;
  }
}

// src/services/syncService.ts
var import_obsidian3 = require("obsidian");

// src/services/vaultScanner.ts
class VaultScanner {
  vault;
  DEFAULT_EXTENSIONS = [".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg"];
  constructor(vault) {
    this.vault = vault;
  }
  async scanVault(options = {}) {
    const includeExtensions = options.includeExtensions || this.DEFAULT_EXTENSIONS;
    const excludePaths = options.excludePaths || [".git", ".obsidian"];
    const recursive = options.recursive !== false;
    const results = [];
    try {
      await this.scanDirectory("", results, includeExtensions, excludePaths, recursive);
      return results;
    } catch (error) {
      console.error("Error scanning vault:", error);
      return [];
    }
  }
  async scanDirectory(dirPath, results, includeExtensions, excludePaths, recursive) {
    try {
      const listing = await this.vault.adapter.list(dirPath);
      for (const filePath of listing.files) {
        if (this.isExcluded(filePath, excludePaths)) {
          continue;
        }
        const extension = this.getExtension(filePath);
        if (!includeExtensions.includes(extension)) {
          continue;
        }
        const stat = await this.vault.adapter.stat(filePath);
        if (stat) {
          results.push({
            path: filePath,
            mtime: stat.mtime,
            ctime: stat.ctime,
            size: stat.size,
            isFolder: false,
            extension
          });
        }
      }
      if (recursive) {
        for (const folderPath of listing.folders) {
          if (this.isExcluded(folderPath, excludePaths)) {
            continue;
          }
          const stat = await this.vault.adapter.stat(folderPath);
          if (stat) {
            results.push({
              path: folderPath,
              mtime: stat.mtime,
              ctime: stat.ctime,
              size: 0,
              isFolder: true
            });
          }
          await this.scanDirectory(folderPath, results, includeExtensions, excludePaths, recursive);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }
  async getFileMetadata(filePath) {
    try {
      const stat = await this.vault.adapter.stat(filePath);
      if (!stat) {
        return null;
      }
      return {
        path: filePath,
        mtime: stat.mtime,
        ctime: stat.ctime,
        size: stat.size,
        isFolder: stat.type === "folder",
        extension: stat.type === "file" ? this.getExtension(filePath) : undefined
      };
    } catch (error) {
      console.error(`Error getting metadata for ${filePath}:`, error);
      return null;
    }
  }
  isExcluded(path, excludePaths) {
    for (const excluded of excludePaths) {
      if (path.startsWith(excluded) || path.includes(`/${excluded}/`)) {
        return true;
      }
    }
    return false;
  }
  getExtension(path) {
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1)
      return "";
    return path.substring(lastDot).toLowerCase();
  }
  async countDirectoryContents(dirPath) {
    try {
      const listing = await this.vault.adapter.list(dirPath);
      return {
        fileCount: listing.files.length,
        folderCount: listing.folders.length
      };
    } catch (error) {
      console.error(`Error counting directory contents for ${dirPath}:`, error);
      return { fileCount: 0, folderCount: 0 };
    }
  }
  async fileExists(filePath) {
    return await this.vault.adapter.exists(filePath);
  }
  async getMultipleFileMetadata(filePaths) {
    const results = new Map;
    const statPromises = filePaths.map(async (path) => {
      const metadata = await this.getFileMetadata(path);
      results.set(path, metadata);
    });
    await Promise.all(statPromises);
    return results;
  }
  hasFileChanged(oldMeta, newMeta) {
    return oldMeta.mtime !== newMeta.mtime || oldMeta.size !== newMeta.size;
  }
}

// src/services/googleDriveService.ts
var import_obsidian2 = require("obsidian");

class GoogleDriveService {
  authService;
  vaultFolderCache = new Map;
  constructor(authService) {
    this.authService = authService;
  }
  async isAuthenticated() {
    return this.authService.isAuthenticated();
  }
  async getOrCreateVaultFolder(vaultId) {
    console.log("  \uD83D\uDCC1 Getting/creating vault folder...");
    console.log("    Vault ID:", vaultId);
    if (this.vaultFolderCache.has(vaultId)) {
      const cachedId = this.vaultFolderCache.get(vaultId);
      console.log("    ✓ Found in cache:", cachedId);
      return cachedId;
    }
    try {
      const folderName = `vault_${vaultId}`;
      console.log("    Searching for folder:", folderName);
      const accessToken = await this.authService.getValidAccessToken();
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`;
      const response = await import_obsidian2.requestUrl({
        url: searchUrl,
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const files = response.json.files || [];
      if (files.length > 0) {
        const folderId2 = files[0].id;
        console.log("    ✓ Found existing folder:", folderId2);
        if (files.length > 1) {
          console.log("    \uD83D\uDDD1️  Found", files.length - 1, "duplicate folder(s), deleting...");
          for (let i = 1;i < files.length; i++) {
            try {
              await this.deleteFile(files[i].id);
              console.log("    ✓ Deleted duplicate folder:", files[i].id);
            } catch (err) {
              console.warn("    ⚠️  Failed to delete duplicate folder:", err);
            }
          }
        }
        this.vaultFolderCache.set(vaultId, folderId2);
        return folderId2;
      }
      console.log("    Creating new folder:", folderName);
      const createResponse = await import_obsidian2.requestUrl({
        url: "https://www.googleapis.com/drive/v3/files",
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: "application/vnd.google-apps.folder"
        })
      });
      const folderId = createResponse.json.id;
      console.log("    ✓ Created new folder:", folderId);
      this.vaultFolderCache.set(vaultId, folderId);
      return folderId;
    } catch (error) {
      console.error("    ❌ Error getting/creating vault folder:", error);
      return null;
    }
  }
  async createFolder(folderName, parentFolderId) {
    try {
      const accessToken = await this.authService.getValidAccessToken();
      const metadata = {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder"
      };
      if (parentFolderId) {
        metadata.parents = [parentFolderId];
      }
      const response = await import_obsidian2.requestUrl({
        url: "https://www.googleapis.com/drive/v3/files",
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(metadata)
      });
      console.log(`    \uD83D\uDCC1 Created folder: ${folderName} (ID: ${response.json.id})`);
      return response.json.id;
    } catch (error) {
      console.error("Error creating folder:", error);
      return null;
    }
  }
  async ensureFolderPath(folderPath, parentFolderId) {
    if (!folderPath) {
      return parentFolderId;
    }
    try {
      const parts = folderPath.split("/").filter((p) => p);
      if (parts.length === 0) {
        return parentFolderId;
      }
      let currentParentId = parentFolderId;
      const accessToken = await this.authService.getValidAccessToken();
      for (const folderName of parts) {
        const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false&fields=files(id,name)`;
        const response = await import_obsidian2.requestUrl({
          url: searchUrl,
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const files = response.json.files || [];
        let folderId = null;
        if (files.length > 0) {
          folderId = files[0].id;
          console.log(`    \uD83D\uDCC1 Found existing folder: ${folderName} (ID: ${folderId})`);
        } else {
          folderId = await this.createFolder(folderName, currentParentId);
          if (!folderId) {
            console.error(`    ❌ Failed to create folder: ${folderName}`);
            return null;
          }
        }
        currentParentId = folderId;
      }
      return currentParentId;
    } catch (error) {
      console.error("Error ensuring folder path:", error);
      return null;
    }
  }
  async uploadFile(filePath, fileData, mimeType, vaultId) {
    console.log("  \uD83D\uDD35 GoogleDriveService.uploadFile() called");
    console.log("    File path:", filePath);
    console.log("    MIME type:", mimeType);
    console.log("    Vault ID:", vaultId);
    console.log("    Data size:", fileData.byteLength, "bytes");
    try {
      const accessToken = await this.authService.getValidAccessToken();
      const vaultFolderId = await this.getOrCreateVaultFolder(vaultId);
      if (!vaultFolderId) {
        return {
          success: false,
          error: "Failed to get/create vault folder"
        };
      }
      const pathParts = filePath.split("/");
      const fileName = pathParts.pop() || filePath;
      const folderPath = pathParts.join("/");
      let targetFolderId = vaultFolderId;
      if (folderPath) {
        console.log("    \uD83D\uDCC1 Ensuring folder path exists:", folderPath);
        targetFolderId = await this.ensureFolderPath(folderPath, vaultFolderId) || vaultFolderId;
        console.log("    Target folder ID:", targetFolderId);
      }
      console.log("    \uD83D\uDD0D Checking for existing file...");
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and '${targetFolderId}' in parents and trashed=false&fields=files(id,name)`;
      const searchResponse = await import_obsidian2.requestUrl({
        url: searchUrl,
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const existingFiles = searchResponse.json.files || [];
      console.log("    Found", existingFiles.length, "existing file(s)");
      let fileId;
      if (existingFiles.length > 0) {
        fileId = existingFiles[0].id;
        console.log("    ♻️  Updating existing file:", fileId);
        if (existingFiles.length > 1) {
          console.log("    \uD83D\uDDD1️  Deleting", existingFiles.length - 1, "duplicate(s)...");
          for (let i = 1;i < existingFiles.length; i++) {
            try {
              await this.deleteFile(existingFiles[i].id);
              console.log("    ✓ Deleted duplicate:", existingFiles[i].id);
            } catch (err) {
              console.warn("    ⚠️  Failed to delete duplicate:", err);
            }
          }
        }
        const boundary = "-------314159265358979323846";
        const delimiter = `\r
--${boundary}\r
`;
        const closeDelimiter = `\r
--${boundary}--`;
        const base64Data = arrayBufferToBase64(fileData);
        const multipartRequestBody = delimiter + `Content-Type: application/json\r
\r
` + JSON.stringify({ mimeType }) + delimiter + "Content-Type: " + mimeType + `\r
` + `Content-Transfer-Encoding: base64\r
\r
` + base64Data + closeDelimiter;
        await import_obsidian2.requestUrl({
          url: `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        });
        console.log("    ✅ File UPDATED");
      } else {
        console.log("    ➕ Creating new file...");
        const boundary = "-------314159265358979323846";
        const delimiter = `\r
--${boundary}\r
`;
        const closeDelimiter = `\r
--${boundary}--`;
        const base64Data = arrayBufferToBase64(fileData);
        const metadata = {
          name: fileName,
          mimeType,
          parents: [targetFolderId]
        };
        const multipartRequestBody = delimiter + `Content-Type: application/json\r
\r
` + JSON.stringify(metadata) + delimiter + "Content-Type: " + mimeType + `\r
` + `Content-Transfer-Encoding: base64\r
\r
` + base64Data + closeDelimiter;
        const createResponse = await import_obsidian2.requestUrl({
          url: "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        });
        fileId = createResponse.json.id;
        console.log("    ✅ File CREATED");
      }
      console.log("    File ID:", fileId);
      return {
        success: true,
        fileId
      };
    } catch (error) {
      console.error("    ❌ Error uploading file:", error);
      return {
        success: false,
        error: `Upload failed: ${error}`
      };
    }
  }
  async downloadFile(fileId) {
    try {
      const accessToken = await this.authService.getValidAccessToken();
      const response = await import_obsidian2.requestUrl({
        url: `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return {
        success: true,
        data: response.arrayBuffer
      };
    } catch (error) {
      console.error("Error downloading file:", error);
      return {
        success: false,
        error: `Download failed: ${error}`
      };
    }
  }
  async listFiles(vaultId) {
    try {
      console.log("\uD83D\uDCCB Listing files from Google Drive...");
      console.log("  Vault ID:", vaultId);
      const accessToken = await this.authService.getValidAccessToken();
      const vaultFolderId = await this.getOrCreateVaultFolder(vaultId);
      if (!vaultFolderId) {
        return {
          success: false,
          error: "Failed to get vault folder"
        };
      }
      console.log("  \uD83D\uDCC2 Vault folder ID:", vaultFolderId);
      const allFiles = [];
      let pageToken = undefined;
      let pageCount = 0;
      do {
        pageCount++;
        let url = `https://www.googleapis.com/drive/v3/files?q='${vaultFolderId}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'&fields=files(id,name,mimeType,modifiedTime,size,webContentLink,webViewLink),nextPageToken&pageSize=1000&orderBy=modifiedTime desc`;
        if (pageToken) {
          url += `&pageToken=${pageToken}`;
        }
        console.log(`  \uD83D\uDCC4 Fetching page ${pageCount}...`);
        const response = await import_obsidian2.requestUrl({
          url,
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const files = response.json.files || [];
        const pageFiles = files.map((file) => ({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: parseInt(file.size || "0"),
          modifiedTime: file.modifiedTime,
          webContentLink: file.webContentLink,
          webViewLink: file.webViewLink
        }));
        allFiles.push(...pageFiles);
        console.log(`  ✓ Page ${pageCount}: ${pageFiles.length} file(s)`);
        pageToken = response.json.nextPageToken;
      } while (pageToken);
      console.log(`  ✅ Total: ${allFiles.length} file(s) across ${pageCount} page(s)`);
      return {
        success: true,
        files: allFiles
      };
    } catch (error) {
      console.error("Error listing files:", error);
      return {
        success: false,
        error: `List files failed: ${error}`
      };
    }
  }
  async deleteFile(fileId) {
    try {
      const accessToken = await this.authService.getValidAccessToken();
      await import_obsidian2.requestUrl({
        url: `https://www.googleapis.com/drive/v3/files/${fileId}`,
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      return {
        success: true
      };
    } catch (error) {
      console.error("Error deleting file:", error);
      return {
        success: false,
        error: `Delete failed: ${error}`
      };
    }
  }
  async getFileMetadata(fileId) {
    try {
      const accessToken = await this.authService.getValidAccessToken();
      const response = await import_obsidian2.requestUrl({
        url: `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,size,webContentLink,webViewLink`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const file = {
        id: response.json.id,
        name: response.json.name,
        mimeType: response.json.mimeType,
        size: parseInt(response.json.size || "0"),
        modifiedTime: response.json.modifiedTime,
        webContentLink: response.json.webContentLink,
        webViewLink: response.json.webViewLink
      };
      return {
        success: true,
        file
      };
    } catch (error) {
      console.error("Error getting file metadata:", error);
      return {
        success: false,
        error: `Get metadata failed: ${error}`
      };
    }
  }
}
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0;i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// src/services/syncService.ts
class SyncService {
  vaultId;
  vault;
  syncStateManager;
  vaultScanner;
  driveService;
  constructor(vaultId, vault, authService, syncStateManager) {
    this.vaultId = vaultId;
    this.vault = vault;
    this.syncStateManager = syncStateManager;
    this.vaultScanner = new VaultScanner(vault);
    this.driveService = new GoogleDriveService(authService);
  }
  async syncVault() {
    try {
      console.log(`
\uD83D\uDD04 Starting delta sync for vault: ${this.vaultId}`);
      if (!this.syncStateManager) {
        console.warn("⚠️  No sync state manager - cannot sync without it");
        return {
          success: false,
          message: "No sync state manager available"
        };
      }
      const localState = this.syncStateManager.getState();
      console.log(`\uD83D\uDCCB Local index: ${Object.keys(localState.files).length} file(s)`);
      const validLocalFiles = new Map;
      for (const [filePath, fileState] of localState.files.entries()) {
        const fileExists = this.vault.getAbstractFileByPath(filePath) !== null;
        if (fileExists || fileState.lastSyncedHash && fileState.lastSyncedHash !== "" && fileState.lastSyncedTime > 0) {
          validLocalFiles.set(filePath, fileState);
        } else {
          console.log(`⏭️  Excluding stale index entry: ${filePath} (doesn't exist locally)`);
        }
      }
      console.log(`\uD83D\uDCCB Valid local files for sync: ${validLocalFiles.size} file(s)`);
      console.log("\uD83D\uDD0D Scanning vault for new files not in index...");
      const vaultFiles = await this.vaultScanner.scanVault({
        includeExtensions: [".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg"],
        recursive: true
      });
      let newFilesFound = 0;
      for (const vaultFile2 of vaultFiles) {
        if (vaultFile2.isFolder)
          continue;
        if (!validLocalFiles.has(vaultFile2.path)) {
          console.log(`  \uD83D\uDCC4 Found new file: ${vaultFile2.path}`);
          validLocalFiles.set(vaultFile2.path, {
            path: vaultFile2.path,
            lastSyncedHash: "",
            lastSyncedTime: 0,
            lastSyncedSize: 0,
            remoteFileId: undefined
          });
          newFilesFound++;
        }
      }
      if (newFilesFound > 0) {
        console.log(`✅ Added ${newFilesFound} new file(s) to sync index`);
      }
      console.log("\uD83D\uDD0D Calculating delta...");
      const delta = await this.calculateDelta(validLocalFiles);
      console.log(`
\uD83D\uDCCA Delta calculated:`);
      console.log(`  To Download: ${delta.toDownload.length}`);
      console.log(`  To Upload: ${delta.toUpload.length}`);
      console.log(`  Conflicts: ${delta.conflicts.length}`);
      console.log(`  In Sync: ${delta.inSync}`);
      let uploadedCount = 0;
      if (delta.toUpload.length > 0) {
        console.log(`
\uD83D\uDCE4 Uploading ${delta.toUpload.length} file(s)...`);
        for (const fileInfo of delta.toUpload) {
          try {
            const file = this.vault.getAbstractFileByPath(fileInfo.filePath);
            if (file instanceof import_obsidian3.TFile) {
              await this.uploadSingleFile(file);
              uploadedCount++;
              console.log(`  ✅ Uploaded: ${fileInfo.filePath} (${fileInfo.reason})`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to upload ${fileInfo.filePath}:`, error);
          }
        }
      }
      let downloadedCount = 0;
      if (delta.toDownload.length > 0) {
        console.log(`
\uD83D\uDCE5 Downloading ${delta.toDownload.length} file(s)...`);
        for (const fileInfo of delta.toDownload) {
          try {
            await this.downloadSingleFile(fileInfo);
            downloadedCount++;
            console.log(`  ✅ Downloaded: ${fileInfo.filePath} (${fileInfo.reason})`);
          } catch (error) {
            console.error(`  ❌ Failed to download ${fileInfo.filePath}:`, error);
          }
        }
      }
      if (delta.conflicts.length > 0) {
        console.log(`
⚠️  ${delta.conflicts.length} conflict(s) detected`);
        for (const conflict of delta.conflicts) {
          console.log(`  ⚠️  ${conflict.filePath}`);
          this.syncStateManager.markConflict(conflict.filePath);
        }
      }
      this.syncStateManager.markFullSyncCompleted();
      this.syncStateManager.markRemoteCheckCompleted();
      console.log(`
✅ Delta sync completed`);
      return {
        success: true,
        message: "Sync completed successfully",
        uploadedFiles: uploadedCount,
        downloadedFiles: downloadedCount,
        conflicts: delta.conflicts.length,
        skippedFiles: delta.inSync
      };
    } catch (error) {
      console.error("Sync failed:", error);
      return {
        success: false,
        message: `Sync failed: ${error}`
      };
    }
  }
  async calculateDelta(localFilesMap) {
    console.log("  \uD83D\uDCE5 Fetching remote files from Google Drive...");
    const listResult = await this.driveService.listFiles(this.vaultId);
    if (!listResult.success) {
      throw new Error(`Failed to list files: ${listResult.error}`);
    }
    const remoteFiles = listResult.files || [];
    console.log("  ✅ Remote files:", remoteFiles.length);
    const remoteFilesMap = new Map;
    for (const file of remoteFiles) {
      remoteFilesMap.set(file.name, file);
    }
    const toDownload = [];
    const toUpload = [];
    const conflicts = [];
    let inSync = 0;
    console.log(`
  \uD83D\uDD0D Analyzing differences...`);
    for (const remoteFile of remoteFiles) {
      const filePath = remoteFile.name;
      const localFile = localFilesMap.get(filePath);
      const remoteMtime = new Date(remoteFile.modifiedTime).getTime();
      if (!localFile) {
        console.log(`  \uD83D\uDCE5 Missing local: ${filePath}`);
        toDownload.push({
          id: remoteFile.id,
          filePath,
          reason: "missing_local",
          remoteMtime,
          remoteSize: remoteFile.size
        });
      } else {
        const localMtime = localFile.lastSyncedTime;
        if (localFile.remoteFileId === remoteFile.id) {
          if (remoteMtime > localMtime) {
            console.log(`  \uD83D\uDCE5 Remote newer: ${filePath}`);
            toDownload.push({
              id: remoteFile.id,
              filePath,
              reason: "remote_newer",
              remoteMtime,
              remoteSize: remoteFile.size
            });
          } else if (localMtime > remoteMtime) {
            console.log(`  \uD83D\uDCE4 Local newer: ${filePath}`);
            toUpload.push({
              filePath,
              reason: "local_newer",
              localMtime,
              localSize: localFile.lastSyncedSize
            });
          } else {
            inSync++;
          }
        } else {
          if (remoteMtime > localMtime) {
            console.log(`  \uD83D\uDCE5 Remote newer (different ID): ${filePath}`);
            toDownload.push({
              id: remoteFile.id,
              filePath,
              reason: "remote_newer",
              remoteMtime,
              remoteSize: remoteFile.size
            });
          } else {
            inSync++;
          }
        }
      }
    }
    for (const [filePath, localFile] of localFilesMap.entries()) {
      const remoteFile = remoteFilesMap.get(filePath);
      if (!remoteFile) {
        if (localFile.lastSyncedTime === 0 && localFile.lastSyncedHash === "") {
          console.log(`  ⏭️  Skipping remote-only tracking entry: ${filePath}`);
          continue;
        }
        if (!localFile.remoteFileId) {
          console.log(`  \uD83D\uDCE4 New local file: ${filePath}`);
          toUpload.push({
            filePath,
            reason: "never_synced",
            localMtime: localFile.lastSyncedTime,
            localSize: localFile.lastSyncedSize
          });
        } else {
          console.log(`  \uD83D\uDCE4 Missing remote (was synced): ${filePath}`);
          toUpload.push({
            filePath,
            reason: "missing_remote",
            localMtime: localFile.lastSyncedTime,
            localSize: localFile.lastSyncedSize
          });
        }
      }
    }
    const delta = {
      toDownload,
      toUpload,
      conflicts,
      inSync,
      totalRemote: remoteFiles.length,
      totalLocal: localFilesMap.size
    };
    console.log(`
  \uD83D\uDCCA Delta Summary:`);
    console.log(`    To Download: ${toDownload.length}`);
    console.log(`    To Upload: ${toUpload.length}`);
    console.log(`    Conflicts: ${conflicts.length}`);
    console.log(`    In Sync: ${inSync}`);
    console.log(`    Total Remote: ${delta.totalRemote}`);
    console.log(`    Total Local: ${delta.totalLocal}`);
    return delta;
  }
  isBinaryFile(extension) {
    const binaryExtensions = ["pdf", "png", "jpg", "jpeg", "gif", "svg", "webp", "mp4", "mp3", "wav"];
    return binaryExtensions.includes(extension.toLowerCase());
  }
  async computeHash(content) {
    const encoder = new TextEncoder;
    const data = content instanceof ArrayBuffer ? new Uint8Array(content) : encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async ensureParentFoldersExist(filePath) {
    const normalizedPath = import_obsidian3.normalizePath(filePath);
    const parentPath = normalizedPath.substring(0, normalizedPath.lastIndexOf("/"));
    if (parentPath && !this.vault.getAbstractFileByPath(parentPath)) {
      const parts = parentPath.split("/");
      let currentPath = "";
      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!this.vault.getAbstractFileByPath(currentPath)) {
          await this.vault.createFolder(currentPath);
          console.log(`  \uD83D\uDCC1 Created folder: ${currentPath}`);
        }
      }
    }
  }
  async syncOnChange(changedFiles) {
    console.log(`Sync triggered by changes to: ${changedFiles.join(", ")}`);
    await this.syncVault();
  }
  async handleFileCreation(filePath) {
    console.log(`\uD83C\uDD95 Handling new file creation: ${filePath}`);
    try {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof import_obsidian3.TFile)) {
        console.log(`  ⚠️ Not a valid file: ${filePath}`);
        return;
      }
      const extension = file.extension;
      const relevantExtensions = ["md", "txt", "pdf", "png", "jpg", "jpeg", "gif", "svg"];
      if (!relevantExtensions.includes(extension.toLowerCase())) {
        console.log(`  ⏭️ Skipping non-relevant file type: ${extension}`);
        return;
      }
      if (this.syncStateManager) {
        const fileState = {
          path: filePath,
          lastSyncedHash: "",
          lastSyncedTime: 0,
          lastSyncedSize: 0,
          remoteFileId: undefined
        };
        this.syncStateManager.getState().files.set(filePath, fileState);
        console.log(`  ✅ Added new file to sync index: ${filePath}`);
        await this.uploadSingleFile(file);
        console.log(`  ✅ Uploaded new file: ${filePath}`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to handle file creation for ${filePath}:`, error);
    }
  }
  async handleFileModification(filePath) {
    console.log(`\uD83D\uDCDD Handling file modification: ${filePath}`);
    try {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof import_obsidian3.TFile)) {
        console.log(`  ⚠️ Not a valid file: ${filePath}`);
        return;
      }
      const extension = file.extension;
      const relevantExtensions = ["md", "txt", "pdf", "png", "jpg", "jpeg", "gif", "svg"];
      if (!relevantExtensions.includes(extension.toLowerCase())) {
        console.log(`  ⏭️ Skipping non-relevant file type: ${extension}`);
        return;
      }
      if (this.syncStateManager) {
        const isBinary = this.isBinaryFile(extension);
        const content = isBinary ? await this.vault.readBinary(file) : await this.vault.read(file);
        const hash = await this.computeHash(content);
        const needsSync = this.syncStateManager.needsSync(filePath, hash, file.stat.mtime, file.stat.size);
        if (needsSync) {
          await this.uploadSingleFile(file);
          console.log(`  ✅ Uploaded modified file: ${filePath}`);
        } else {
          console.log(`  ⏭️ File unchanged, skipping: ${filePath}`);
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed to handle file modification for ${filePath}:`, error);
    }
  }
  async handleFileDeletion(filePath) {
    console.log(`\uD83D\uDDD1️ Handling file deletion: ${filePath}`);
    try {
      if (this.syncStateManager) {
        this.syncStateManager.removeFile(filePath);
        console.log(`  ✅ Removed file from sync index: ${filePath}`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to handle file deletion for ${filePath}:`, error);
    }
  }
  async handleFolderCreation(folderPath) {
    console.log(`\uD83D\uDCC1 Handling folder creation: ${folderPath}`);
    try {
      if (this.syncStateManager) {
        const metadata = await this.vaultScanner.getFileMetadata(folderPath);
        if (metadata && metadata.isFolder) {
          this.syncStateManager.trackFolder(folderPath, metadata.mtime, 0, 0, undefined);
          console.log(`  ✅ Added folder to sync index: ${folderPath}`);
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed to handle folder creation for ${folderPath}:`, error);
    }
  }
  async handleFolderDeletion(folderPath) {
    console.log(`\uD83D\uDDD1️ Handling folder deletion: ${folderPath}`);
    try {
      if (this.syncStateManager) {
        this.syncStateManager.removeFolder(folderPath);
        console.log(`  ✅ Removed folder from sync index: ${folderPath}`);
        const files = this.syncStateManager.getState().files;
        const filesToRemove = [];
        files.forEach((fileState, filePath) => {
          if (filePath.startsWith(folderPath + "/")) {
            filesToRemove.push(filePath);
          }
        });
        for (const filePath of filesToRemove) {
          this.syncStateManager.removeFile(filePath);
          console.log(`  ✅ Removed file from sync index: ${filePath}`);
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed to handle folder deletion for ${folderPath}:`, error);
    }
  }
  async handleFolderRename(oldPath, newPath) {
    console.log(`\uD83D\uDCDD Handling folder rename: ${oldPath} → ${newPath}`);
    try {
      if (this.syncStateManager) {
        this.syncStateManager.renameFolder(oldPath, newPath);
        console.log(`  ✅ Updated folder path in sync index`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to handle folder rename from ${oldPath} to ${newPath}:`, error);
    }
  }
  async reconcileIndex() {
    console.log("\uD83D\uDD0D Reconciling sync index with vault files and folders...");
    if (!this.syncStateManager) {
      console.warn("  ⚠️ No sync state manager available");
      return 0;
    }
    try {
      const vaultFiles = await this.vaultScanner.scanVault({
        includeExtensions: [".md", ".txt", ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg"],
        recursive: true
      });
      const currentIndex = this.syncStateManager.getState().files;
      const folderIndex = this.syncStateManager.getState().folders;
      let newFilesFound = 0;
      let newFoldersFound = 0;
      let staleEntriesRemoved = 0;
      for (const vaultItem of vaultFiles) {
        if (vaultItem.isFolder) {
          if (!folderIndex.has(vaultItem.path)) {
            console.log(`  \uD83D\uDCC1 Found untracked folder: ${vaultItem.path}`);
            this.syncStateManager.trackFolder(vaultItem.path, vaultItem.mtime, 0, 0, undefined);
            newFoldersFound++;
          }
          continue;
        }
        if (!currentIndex.has(vaultFile.path)) {
          console.log(`  \uD83D\uDCC4 Found untracked file: ${vaultFile.path}`);
          currentIndex.set(vaultFile.path, {
            path: vaultFile.path,
            lastSyncedHash: "",
            lastSyncedTime: 0,
            lastSyncedSize: 0,
            remoteFileId: undefined
          });
          newFilesFound++;
          try {
            const file = this.vault.getAbstractFileByPath(vaultFile.path);
            if (file instanceof import_obsidian3.TFile) {
              await this.uploadSingleFile(file);
              console.log(`    ✅ Uploaded untracked file: ${vaultFile.path}`);
            }
          } catch (error) {
            console.error(`    ❌ Failed to upload untracked file ${vaultFile.path}:`, error);
          }
        }
      }
      const vaultFilePaths = new Set(vaultFiles.filter((f) => !f.isFolder).map((f) => f.path));
      const indexPaths = Array.from(currentIndex.keys());
      for (const indexPath of indexPaths) {
        if (!vaultFilePaths.has(indexPath)) {
          const fileState = currentIndex.get(indexPath);
          if (!fileState?.remoteFileId || fileState?.lastSyncedHash === "") {
            console.log(`  \uD83D\uDDD1️ Removing stale index entry: ${indexPath}`);
            this.syncStateManager.removeFile(indexPath);
            staleEntriesRemoved++;
          } else {
            console.log(`  ⚠️ File in index but not in vault (may need download): ${indexPath}`);
          }
        }
      }
      if (newFilesFound > 0 || newFoldersFound > 0 || staleEntriesRemoved > 0) {
        console.log(`✅ Index reconciliation complete:`);
        console.log(`   - ${newFilesFound} new file(s) added to index`);
        console.log(`   - ${newFoldersFound} new folder(s) tracked`);
        console.log(`   - ${staleEntriesRemoved} stale entries removed`);
      } else {
        console.log("✅ Index is in sync with vault");
      }
      return newFilesFound;
    } catch (error) {
      console.error("❌ Failed to reconcile index:", error);
      return 0;
    }
  }
  async uploadSingleFile(file) {
    const isBinary = this.isBinaryFile(file.extension);
    const content = isBinary ? await this.vault.readBinary(file) : await this.vault.read(file);
    const hash = await this.computeHash(content);
    const mimeType = this.getMimeType(file.extension);
    let fileData;
    if (isBinary) {
      fileData = content;
    } else {
      const encoder = new TextEncoder;
      fileData = encoder.encode(content).buffer;
    }
    const result = await this.driveService.uploadFile(file.path, fileData, mimeType, this.vaultId);
    if (result.success && this.syncStateManager) {
      const metadata = await this.vaultScanner.getFileMetadata(file.path);
      this.syncStateManager.markSynced(file.path, hash, file.stat.mtime, file.stat.size, result.fileId, {
        ctime: metadata?.ctime,
        extension: metadata?.extension,
        operation: "upload"
      });
    } else {
      if (this.syncStateManager) {
        this.syncStateManager.markSyncError(file.path, result.error || "Unknown error", "upload");
      }
      throw new Error(`Upload failed: ${result.error}`);
    }
  }
  async downloadSingleFile(fileInfo) {
    const result = await this.driveService.downloadFile(fileInfo.id);
    if (!result.success || !result.data) {
      throw new Error(`Download failed: ${result.error}`);
    }
    const normalizedPath = import_obsidian3.normalizePath(fileInfo.filePath);
    const existingFile = this.vault.getAbstractFileByPath(normalizedPath);
    const extension = normalizedPath.substring(normalizedPath.lastIndexOf(".")).slice(1);
    const isBinary = this.isBinaryFile(extension);
    const fileData = result.data;
    if (existingFile instanceof import_obsidian3.TFile) {
      if (isBinary) {
        await this.vault.modifyBinary(existingFile, fileData);
      } else {
        const textContent = new TextDecoder().decode(fileData);
        await this.vault.modify(existingFile, textContent);
      }
    } else {
      await this.ensureParentFoldersExist(normalizedPath);
      if (isBinary) {
        await this.vault.createBinary(normalizedPath, fileData);
      } else {
        const textContent = new TextDecoder().decode(fileData);
        await this.vault.create(normalizedPath, textContent);
      }
    }
    if (this.syncStateManager) {
      const file = this.vault.getAbstractFileByPath(normalizedPath);
      if (file instanceof import_obsidian3.TFile) {
        const content = isBinary ? await this.vault.readBinary(file) : await this.vault.read(file);
        const hash = await this.computeHash(content);
        const metadata = await this.vaultScanner.getFileMetadata(normalizedPath);
        this.syncStateManager.markSynced(normalizedPath, hash, file.stat.mtime, file.stat.size, fileInfo.id, {
          ctime: metadata?.ctime,
          extension: metadata?.extension,
          operation: "download"
        });
      }
    }
  }
  getMimeType(extension) {
    const mimeTypes = {
      md: "text/markdown",
      txt: "text/plain",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav"
    };
    return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
  }
}

// src/services/conflictUI.ts
var import_obsidian4 = require("obsidian");

class ConflictUIService {
  app;
  syncService;
  conflicts = new Map;
  resolutionCallbacks = [];
  constructor(app, syncService) {
    this.app = app;
    this.syncService = syncService;
  }
  onResolution(callback) {
    this.resolutionCallbacks.push(callback);
  }
  removeResolutionListener(callback) {
    const index = this.resolutionCallbacks.indexOf(callback);
    if (index > -1) {
      this.resolutionCallbacks.splice(index, 1);
    }
  }
  addConflict(conflict) {
    this.conflicts.set(conflict.id, conflict);
    console.log(`New conflict detected: ${conflict.filePath}`);
    this.displayConflictNotification(conflict);
  }
  getPendingConflicts() {
    return Array.from(this.conflicts.values());
  }
  getConflict(conflictId) {
    return this.conflicts.get(conflictId) || null;
  }
  async resolveConflict(conflictId, resolution, resolvedContent) {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      console.error(`Conflict ${conflictId} not found`);
      return false;
    }
    const result = {
      conflictId,
      resolution,
      ...resolvedContent !== undefined && { resolvedContent }
    };
    for (const callback of this.resolutionCallbacks) {
      try {
        callback(result);
      } catch (error) {
        console.error("Error in resolution callback:", error);
      }
    }
    this.conflicts.delete(conflictId);
    console.log(`Conflict resolved: ${conflict.filePath} -> ${resolution}`);
    return true;
  }
  displayConflictNotification(conflict) {
    console.log(`
=== CONFLICT DETECTED ===`);
    console.log(`File: ${conflict.filePath}`);
    console.log(`Local version: ${conflict.localVersion.size} bytes, modified: ${new Date(conflict.localVersion.lastModified).toLocaleString()}`);
    console.log(`Remote version: ${conflict.remoteVersion.size} bytes, modified: ${new Date(conflict.remoteVersion.lastModified).toLocaleString()}`);
    console.log(`========================
`);
    new ConflictResolutionModal(this.app, conflict, (resolution, content) => {
      this.resolveConflict(conflict.id, resolution, content);
    }).open();
  }
  async autoResolveConflict(conflict) {
    const { localVersion, remoteVersion } = conflict;
    let resolution = "manual";
    let resolvedContent;
    const sizeDifference = Math.abs(localVersion.size - remoteVersion.size);
    if (sizeDifference > 1024) {
      resolution = localVersion.size > remoteVersion.size ? "local" : "remote";
    } else if (localVersion.lastModified !== remoteVersion.lastModified) {
      resolution = localVersion.lastModified > remoteVersion.lastModified ? "local" : "remote";
    } else if (Math.abs(localVersion.lastModified - remoteVersion.lastModified) < 60000) {
      resolution = "manual";
      resolvedContent = this.mergeContent(localVersion.content, remoteVersion.content);
    }
    await this.resolveConflict(conflict.id, resolution, resolvedContent);
  }
  mergeContent(localContent, remoteContent) {
    return `<<<<<<< LOCAL VERSION
${localContent}
=======
${remoteContent}
>>>>>>> REMOTE VERSION`;
  }
  displayConflictOptions(conflict) {
    console.log(`
Conflict Resolution Options for: ${conflict.filePath}`);
    console.log("1. Keep local version");
    console.log("2. Keep remote version");
    console.log("3. Merge manually");
    console.log("4. View diff");
    console.log(`
Choose an option (1-4):`);
  }
  showDiff(conflict) {
    console.log(`
=== DIFF for ${conflict.filePath} ===`);
    console.log("--- LOCAL VERSION ---");
    console.log(conflict.localVersion.content.substring(0, 500) + (conflict.localVersion.content.length > 500 ? "..." : ""));
    console.log(`
--- REMOTE VERSION ---`);
    console.log(conflict.remoteVersion.content.substring(0, 500) + (conflict.remoteVersion.content.length > 500 ? "..." : ""));
    console.log(`========================
`);
  }
  getConflictStats() {
    const total = this.conflicts.size;
    return {
      total,
      resolved: 0,
      pending: total
    };
  }
  clearConflicts() {
    this.conflicts.clear();
    console.log("All conflicts cleared");
  }
}

class ConflictResolutionModal extends import_obsidian4.Modal {
  conflict;
  onChoose;
  constructor(app, conflict, onChoose) {
    super(app);
    this.conflict = conflict;
    this.onChoose = onChoose;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Sync Conflict Detected" });
    contentEl.createEl("p", {
      text: `A conflict was detected in: ${this.conflict.filePath}`,
      cls: "conflict-file-path"
    });
    const localDiv = contentEl.createDiv({ cls: "conflict-version" });
    localDiv.createEl("h3", { text: "Local Version" });
    localDiv.createEl("p", { text: `Size: ${this.conflict.localVersion.size} bytes` });
    localDiv.createEl("p", {
      text: `Modified: ${new Date(this.conflict.localVersion.lastModified).toLocaleString()}`
    });
    const remoteDiv = contentEl.createDiv({ cls: "conflict-version" });
    remoteDiv.createEl("h3", { text: "Remote Version" });
    remoteDiv.createEl("p", { text: `Size: ${this.conflict.remoteVersion.size} bytes` });
    remoteDiv.createEl("p", {
      text: `Modified: ${new Date(this.conflict.remoteVersion.lastModified).toLocaleString()}`
    });
    const buttonContainer = contentEl.createDiv({ cls: "conflict-buttons" });
    new import_obsidian4.Setting(buttonContainer).addButton((button) => button.setButtonText("Keep Local").onClick(() => {
      this.onChoose("local");
      this.close();
    }));
    new import_obsidian4.Setting(buttonContainer).addButton((button) => button.setButtonText("Keep Remote").onClick(() => {
      this.onChoose("remote");
      this.close();
    }));
    new import_obsidian4.Setting(buttonContainer).addButton((button) => button.setButtonText("Keep Both (Merge)").setWarning().onClick(() => {
      const merged = this.mergeContent(this.conflict.localVersion.content, this.conflict.remoteVersion.content);
      this.onChoose("manual", merged);
      this.close();
    }));
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
  mergeContent(localContent, remoteContent) {
    return `<<<<<<< LOCAL VERSION
${localContent}
=======
${remoteContent}
>>>>>>> REMOTE VERSION`;
  }
}

// src/services/syncState.ts
class SyncStateManager {
  state;
  constructor(vaultId, initialState) {
    if (initialState) {
      this.state = {
        ...initialState,
        lastRemoteCheck: initialState.lastRemoteCheck || 0,
        files: new Map(Object.entries(initialState.files || {})),
        folders: new Map(Object.entries(initialState.folders || {}))
      };
    } else {
      this.state = {
        vaultId,
        lastFullSync: 0,
        lastRemoteCheck: 0,
        files: new Map,
        folders: new Map
      };
    }
  }
  needsSync(filePath, currentHash, currentMtime, currentSize) {
    const fileState = this.state.files.get(filePath);
    if (!fileState) {
      return true;
    }
    if (fileState.lastSyncedHash !== currentHash) {
      return true;
    }
    if (fileState.lastSyncedSize !== currentSize) {
      return true;
    }
    if (fileState.lastSyncedTime < currentMtime) {
      return true;
    }
    return false;
  }
  markSynced(filePath, hash, mtime, size, remoteFileId, options) {
    const existing = this.state.files.get(filePath);
    const now = Date.now();
    const isFirstSync = !existing;
    const newOperation = {
      timestamp: now,
      operation: options?.operation || "upload",
      success: true
    };
    const history = existing?.history || [];
    history.unshift(newOperation);
    if (history.length > 5) {
      history.pop();
    }
    this.state.files.set(filePath, {
      path: filePath,
      lastSyncedHash: hash,
      lastSyncedTime: mtime,
      lastSyncedSize: size,
      createdTime: options?.ctime || existing?.createdTime,
      extension: options?.extension || existing?.extension || this.getExtension(filePath),
      remoteFileId: remoteFileId || existing?.remoteFileId,
      lastRemoteCheck: existing?.lastRemoteCheck,
      remoteHash: existing?.remoteHash,
      remoteMtime: existing?.remoteMtime,
      firstSyncedTime: existing?.firstSyncedTime || now,
      syncCount: (existing?.syncCount || 0) + 1,
      lastError: undefined,
      conflictCount: existing?.conflictCount || 0,
      history
    });
  }
  getExtension(path) {
    const lastDot = path.lastIndexOf(".");
    if (lastDot === -1)
      return "";
    return path.substring(lastDot).toLowerCase();
  }
  removeFile(filePath) {
    const existing = this.state.files.get(filePath);
    if (existing) {
      const deleteOp = {
        timestamp: Date.now(),
        operation: "delete",
        success: true
      };
      const history = existing.history || [];
      history.unshift(deleteOp);
      if (history.length > 5) {
        history.pop();
      }
      existing.history = history;
    }
    this.state.files.delete(filePath);
  }
  getRemoteFileId(filePath) {
    return this.state.files.get(filePath)?.remoteFileId;
  }
  markSyncError(filePath, error, operation) {
    const existing = this.state.files.get(filePath);
    if (!existing) {
      this.state.files.set(filePath, {
        path: filePath,
        lastSyncedHash: "",
        lastSyncedTime: 0,
        lastSyncedSize: 0,
        lastError: error,
        syncCount: 0,
        conflictCount: 0,
        history: [{
          timestamp: Date.now(),
          operation,
          success: false,
          error
        }]
      });
      return;
    }
    existing.lastError = error;
    const errorOp = {
      timestamp: Date.now(),
      operation,
      success: false,
      error
    };
    const history = existing.history || [];
    history.unshift(errorOp);
    if (history.length > 5) {
      history.pop();
    }
    existing.history = history;
  }
  markConflict(filePath) {
    const existing = this.state.files.get(filePath);
    if (!existing) {
      return;
    }
    existing.conflictCount = (existing.conflictCount || 0) + 1;
    const conflictOp = {
      timestamp: Date.now(),
      operation: "conflict",
      success: false,
      error: "Conflict detected: both local and remote modified"
    };
    const history = existing.history || [];
    history.unshift(conflictOp);
    if (history.length > 5) {
      history.pop();
    }
    existing.history = history;
  }
  getFilesWithErrors() {
    const filesWithErrors = [];
    this.state.files.forEach((state, path) => {
      if (state.lastError) {
        filesWithErrors.push({ path, error: state.lastError });
      }
    });
    return filesWithErrors;
  }
  getFilesWithConflicts() {
    const filesWithConflicts = [];
    this.state.files.forEach((state, path) => {
      if (state.conflictCount && state.conflictCount > 0) {
        filesWithConflicts.push({ path, conflictCount: state.conflictCount });
      }
    });
    return filesWithConflicts;
  }
  markFullSyncCompleted() {
    this.state.lastFullSync = Date.now();
  }
  timeSinceLastFullSync() {
    return Date.now() - this.state.lastFullSync;
  }
  needsFullSync(maxAge = 24 * 60 * 60 * 1000) {
    return this.timeSinceLastFullSync() > maxAge;
  }
  getSyncedFiles() {
    return Array.from(this.state.files.keys());
  }
  getSyncedFileCount() {
    return this.state.files.size;
  }
  toJSON() {
    return {
      vaultId: this.state.vaultId,
      lastFullSync: this.state.lastFullSync,
      lastRemoteCheck: this.state.lastRemoteCheck,
      files: Object.fromEntries(this.state.files),
      folders: Object.fromEntries(this.state.folders)
    };
  }
  getStats() {
    const filesWithErrors = this.getFilesWithErrors();
    const filesWithConflicts = this.getFilesWithConflicts();
    const extensionCounts = {};
    this.state.files.forEach((state) => {
      if (state.extension) {
        extensionCounts[state.extension] = (extensionCounts[state.extension] || 0) + 1;
      }
    });
    let totalSyncCount = 0;
    this.state.files.forEach((state) => {
      totalSyncCount += state.syncCount || 0;
    });
    const avgSyncCount = this.state.files.size > 0 ? Math.round(totalSyncCount / this.state.files.size * 10) / 10 : 0;
    return {
      vaultId: this.state.vaultId,
      totalFilesSynced: this.state.files.size,
      totalFoldersTracked: this.state.folders.size,
      filesWithErrors: filesWithErrors.length,
      filesWithConflicts: filesWithConflicts.length,
      extensionCounts,
      avgSyncCount,
      lastFullSync: new Date(this.state.lastFullSync).toISOString(),
      timeSinceLastFullSync: this.timeSinceLastFullSync()
    };
  }
  clear() {
    this.state.files.clear();
    this.state.folders.clear();
    this.state.lastFullSync = 0;
    this.state.lastRemoteCheck = 0;
  }
  updateRemoteFileInfo(filePath, remoteFileId, remoteMtime, remoteHash) {
    const existing = this.state.files.get(filePath);
    if (existing) {
      existing.lastRemoteCheck = Date.now();
      existing.remoteMtime = remoteMtime;
      existing.remoteHash = remoteHash;
      existing.remoteFileId = remoteFileId;
    } else {
      this.state.files.set(filePath, {
        path: filePath,
        lastSyncedHash: "",
        lastSyncedTime: 0,
        lastSyncedSize: 0,
        remoteFileId,
        lastRemoteCheck: Date.now(),
        remoteMtime,
        remoteHash
      });
    }
  }
  markRemoteCheckCompleted() {
    this.state.lastRemoteCheck = Date.now();
  }
  needsRemoteCheck(intervalMs = 2 * 60 * 1000) {
    return Date.now() - this.state.lastRemoteCheck > intervalMs;
  }
  shouldDownloadRemoteFile(filePath, remoteFileId, remoteMtime, localExists, localMtime, localHash) {
    const fileState = this.state.files.get(filePath);
    if (!localExists) {
      console.log(`  → Download: ${filePath} (not in local vault)`);
      return "download";
    }
    if (!fileState) {
      if (localHash && localHash.length > 0) {
        console.log(`  → Conflict: ${filePath} (exists locally with content but never synced)`);
        return "conflict";
      } else {
        console.log(`  → Download: ${filePath} (exists locally but empty/no sync state)`);
        return "download";
      }
    }
    if (fileState.lastSyncedTime === 0 && fileState.lastSyncedHash === "") {
      if (!localExists) {
        console.log(`  → Download: ${filePath} (remote file never synced, not in local vault)`);
        return "download";
      } else {
        if (localHash && localHash.length > 0) {
          console.log(`  → Conflict: ${filePath} (exists locally with content but never synced)`);
          return "conflict";
        } else {
          console.log(`  → Download: ${filePath} (remote file never synced, empty local file)`);
          return "download";
        }
      }
    }
    if (fileState.remoteMtime && remoteMtime <= fileState.remoteMtime) {
      if (fileState.lastSyncedTime === 0) {
        console.log(`  → Download: ${filePath} (remote exists but never downloaded)`);
        return "download";
      }
      console.log(`  → Skip: ${filePath} (remote unchanged)`);
      return "skip";
    }
    const localChanged = fileState.lastSyncedHash !== localHash || fileState.lastSyncedTime < localMtime;
    if (localChanged && remoteMtime > fileState.lastSyncedTime) {
      console.log(`  → Conflict: ${filePath} (both local and remote modified)`);
      return "conflict";
    }
    if (remoteMtime > fileState.lastSyncedTime && !localChanged) {
      console.log(`  → Download: ${filePath} (remote newer, local unchanged)`);
      return "download";
    }
    console.log(`  → Skip: ${filePath} (local is current)`);
    return "skip";
  }
  getFileState(filePath) {
    return this.state.files.get(filePath);
  }
  trackFolder(folderPath, mtime, fileCount, subfolderCount, remoteFolderId) {
    this.state.folders.set(folderPath, {
      path: folderPath,
      lastSyncedTime: mtime,
      remoteFolderId,
      lastRemoteCheck: Date.now(),
      fileCount,
      subfolderCount
    });
  }
  updateFolder(folderPath, mtime, fileCount, subfolderCount) {
    const existing = this.state.folders.get(folderPath);
    if (existing) {
      existing.lastSyncedTime = mtime;
      existing.lastRemoteCheck = Date.now();
      if (fileCount !== undefined)
        existing.fileCount = fileCount;
      if (subfolderCount !== undefined)
        existing.subfolderCount = subfolderCount;
    } else {
      this.trackFolder(folderPath, mtime, fileCount || 0, subfolderCount || 0);
    }
  }
  removeFolder(folderPath) {
    this.state.folders.delete(folderPath);
  }
  getFolderState(folderPath) {
    return this.state.folders.get(folderPath);
  }
  getTrackedFolders() {
    return Array.from(this.state.folders.keys());
  }
  getTrackedFolderCount() {
    return this.state.folders.size;
  }
  hasFolderChanged(folderPath, fileCount, subfolderCount) {
    const folderState = this.state.folders.get(folderPath);
    if (!folderState) {
      return true;
    }
    if (folderState.fileCount !== fileCount || folderState.subfolderCount !== subfolderCount) {
      return true;
    }
    return false;
  }
  renameFolder(oldPath, newPath) {
    const folderState = this.state.folders.get(oldPath);
    if (folderState) {
      folderState.path = newPath;
      this.state.folders.set(newPath, folderState);
      this.state.folders.delete(oldPath);
      const filesToUpdate = [];
      this.state.files.forEach((fileState, filePath) => {
        if (filePath.startsWith(oldPath + "/")) {
          const newFilePath = filePath.replace(oldPath, newPath);
          fileState.path = newFilePath;
          filesToUpdate.push([newFilePath, fileState]);
          this.state.files.delete(filePath);
        }
      });
      filesToUpdate.forEach(([path, state]) => {
        this.state.files.set(path, state);
      });
      console.log(`\uD83D\uDCC1 Renamed folder: ${oldPath} → ${newPath}`);
      console.log(`   Updated ${filesToUpdate.length} file(s) in folder`);
    }
  }
  getState() {
    return this.state;
  }
  setState(state) {
    this.state = state;
  }
}

// src/services/syncIndexFile.ts
class SyncIndexFile {
  vault;
  indexPath;
  CURRENT_VERSION = "1.0.0";
  constructor(vault, pluginDir = ".obsidian/plugins/obsidian-sync") {
    this.vault = vault;
    this.indexPath = `${pluginDir}/sync-index.json`;
  }
  async load() {
    try {
      const fileExists = await this.vault.adapter.exists(this.indexPath);
      if (!fileExists) {
        console.log("\uD83D\uDCC4 No sync index file found, will create on first save");
        return null;
      }
      console.log("\uD83D\uDCC4 Loading sync index from:", this.indexPath);
      const content = await this.vault.adapter.read(this.indexPath);
      const data = JSON.parse(content);
      if (!data.version) {
        console.warn("⚠️ Sync index missing version, migrating...");
      }
      const filesMap = new Map(Object.entries(data.files || {}));
      const foldersMap = new Map(Object.entries(data.folders || {}));
      const state = {
        vaultId: data.vaultId,
        lastFullSync: data.lastFullSync || 0,
        lastRemoteCheck: data.lastRemoteCheck || 0,
        files: filesMap,
        folders: foldersMap
      };
      console.log(`✅ Loaded sync index: ${filesMap.size} file(s), ${foldersMap.size} folder(s)`);
      return state;
    } catch (error) {
      console.error("❌ Failed to load sync index:", error);
      return null;
    }
  }
  async save(state) {
    try {
      const filesRecord = {};
      state.files.forEach((value, key) => {
        filesRecord[key] = value;
      });
      const foldersRecord = {};
      state.folders.forEach((value, key) => {
        foldersRecord[key] = value;
      });
      const data = {
        version: this.CURRENT_VERSION,
        vaultId: state.vaultId,
        lastFullSync: state.lastFullSync,
        lastRemoteCheck: state.lastRemoteCheck,
        files: filesRecord,
        folders: foldersRecord
      };
      const content = JSON.stringify(data, null, 2);
      await this.vault.adapter.write(this.indexPath, content);
      console.log(`\uD83D\uDCBE Saved sync index: ${state.files.size} file(s), ${state.folders.size} folder(s) to ${this.indexPath}`);
      return true;
    } catch (error) {
      console.error("❌ Failed to save sync index:", error);
      return false;
    }
  }
  async migrateFromPluginData(oldData) {
    console.log("\uD83D\uDD04 Migrating sync state from plugin data to JSON file...");
    const state = {
      vaultId: oldData.vaultId || "",
      lastFullSync: oldData.lastFullSync || 0,
      lastRemoteCheck: oldData.lastRemoteCheck || 0,
      files: new Map,
      folders: new Map
    };
    if (oldData.files) {
      if (oldData.files instanceof Map) {
        state.files = oldData.files;
      } else {
        state.files = new Map(Object.entries(oldData.files));
      }
    }
    if (oldData.folders) {
      if (oldData.folders instanceof Map) {
        state.folders = oldData.folders;
      } else {
        state.folders = new Map(Object.entries(oldData.folders));
      }
    }
    console.log(`✅ Migrated ${state.files.size} file(s), ${state.folders.size} folder(s)`);
    await this.save(state);
    return state;
  }
  async exists() {
    return await this.vault.adapter.exists(this.indexPath);
  }
  async delete() {
    try {
      const exists = await this.exists();
      if (exists) {
        await this.vault.adapter.remove(this.indexPath);
        console.log("\uD83D\uDDD1️ Deleted sync index file");
        return true;
      }
      return false;
    } catch (error) {
      console.error("❌ Failed to delete sync index:", error);
      return false;
    }
  }
  getIndexPath() {
    return this.indexPath;
  }
  async getStats() {
    const exists = await this.exists();
    if (!exists) {
      return { exists: false, fileCount: 0 };
    }
    try {
      const stat = await this.vault.adapter.stat(this.indexPath);
      const state = await this.load();
      return {
        exists: true,
        fileCount: state?.files.size || 0,
        fileSizeKB: stat ? Math.round(stat.size / 1024) : undefined,
        lastModified: stat?.mtime
      };
    } catch (error) {
      console.error("Failed to get sync index stats:", error);
      return { exists: true, fileCount: 0 };
    }
  }
}

// src/services/googleDriveAuth.ts
var import_obsidian5 = require("obsidian");

class GoogleDriveAuthService {
  clientId;
  clientSecret;
  redirectUri;
  tokens = null;
  constructor(clientId, clientSecret, redirectUri = "urn:ietf:wg:oauth:2.0:oob") {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }
  getAuthUrl() {
    const scopes = [
      "https://www.googleapis.com/auth/drive.file"
    ];
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent"
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  async exchangeCodeForTokens(code) {
    try {
      const response = await import_obsidian5.requestUrl({
        url: "https://oauth2.googleapis.com/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: "authorization_code"
        }).toString()
      });
      const data = response.json;
      if (!data.access_token) {
        throw new Error("No access token received");
      }
      this.tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        scope: data.scope || "",
        token_type: data.token_type || "Bearer",
        expiry_date: Date.now() + data.expires_in * 1000
      };
      return this.tokens;
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      throw new Error(`Failed to exchange authorization code: ${error}`);
    }
  }
  setTokens(tokens) {
    this.tokens = tokens;
  }
  getTokens() {
    return this.tokens;
  }
  isAuthenticated() {
    return this.tokens !== null && this.tokens.access_token !== undefined;
  }
  isTokenExpired() {
    if (!this.tokens || !this.tokens.expiry_date) {
      return true;
    }
    return Date.now() >= this.tokens.expiry_date - 60000;
  }
  async refreshAccessToken() {
    if (!this.tokens?.refresh_token) {
      throw new Error("No refresh token available");
    }
    try {
      const response = await import_obsidian5.requestUrl({
        url: "https://oauth2.googleapis.com/token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          refresh_token: this.tokens.refresh_token,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "refresh_token"
        }).toString()
      });
      const data = response.json;
      this.tokens = {
        ...this.tokens,
        access_token: data.access_token,
        expiry_date: Date.now() + data.expires_in * 1000
      };
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw new Error(`Failed to refresh access token: ${error}`);
    }
  }
  async getValidAccessToken() {
    if (!this.tokens) {
      throw new Error("Not authenticated");
    }
    if (this.isTokenExpired() && this.tokens.refresh_token) {
      await this.refreshAccessToken();
    }
    return this.tokens.access_token;
  }
  async revokeTokens() {
    if (!this.tokens) {
      return;
    }
    try {
      await import_obsidian5.requestUrl({
        url: `https://oauth2.googleapis.com/revoke?token=${this.tokens.access_token}`,
        method: "POST"
      });
      this.tokens = null;
    } catch (error) {
      console.error("Error revoking tokens:", error);
      this.tokens = null;
    }
  }
}

// src/main.ts
var DEFAULT_SETTINGS = {
  googleClientId: "",
  googleClientSecret: "",
  googleTokens: null,
  vaultId: "",
  syncInterval: 30,
  autoSync: true,
  conflictResolution: "manual",
  syncState: null
};

class ObsidianSyncPlugin extends import_obsidian6.Plugin {
  settings = DEFAULT_SETTINGS;
  googleAuthService = null;
  syncTimer = null;
  remoteCheckTimer = null;
  indexReconcileTimer = null;
  vaultWatcher = null;
  syncService = null;
  conflictUI = null;
  syncStateManager = null;
  syncIndexFile = null;
  pendingChanges = new Set;
  syncDebounceTimer = null;
  callbackServer = null;
  async onload() {
    await this.loadSettings();
    await this.initializeGoogleDrive();
    this.addRibbonIcon("sync", "Obsidian Sync", () => {
      this.syncVault();
    });
    this.addSettingTab(new ObsidianSyncSettingTab(this.app, this));
    this.initializeServices();
    this.addCommand({
      id: "sync-vault",
      name: "Sync Vault",
      callback: () => {
        this.syncVault();
      }
    });
    this.addCommand({
      id: "test-connection",
      name: "Test Google Drive Connection",
      callback: async () => {
        if (this.googleAuthService?.isAuthenticated()) {
          new import_obsidian6.Notice("✓ Google Drive is authenticated and ready");
        } else {
          new import_obsidian6.Notice("✗ Google Drive not authenticated. Please authenticate in plugin settings.");
        }
      }
    });
    this.addCommand({
      id: "reconcile-index",
      name: "Reconcile Sync Index",
      callback: async () => {
        if (this.syncService) {
          new import_obsidian6.Notice("Reconciling sync index...");
          try {
            const newFiles = await this.syncService.reconcileIndex();
            if (newFiles > 0) {
              new import_obsidian6.Notice(`Found and uploaded ${newFiles} untracked file(s)`);
              await this.saveSyncState();
            } else {
              new import_obsidian6.Notice("Index is already in sync");
            }
          } catch (error) {
            new import_obsidian6.Notice("Failed to reconcile index: " + error.message);
          }
        } else {
          new import_obsidian6.Notice("Sync service not initialized");
        }
      }
    });
    console.log("Obsidian Sync plugin loaded");
  }
  onunload() {
    this.stopAutoSync();
    this.stopRemoteCheck();
    this.stopIndexReconciliation();
    if (this.vaultWatcher) {
      this.vaultWatcher.stopWatching();
    }
    console.log("Obsidian Sync plugin unloaded");
  }
  async initializeServices() {
    try {
      console.log("Initializing services...");
      console.log("  Vault ID:", this.settings.vaultId || "(not set)");
      if (!this.googleAuthService?.isAuthenticated()) {
        console.warn("⚠️  Google Drive not authenticated - sync will not work");
        new import_obsidian6.Notice("Please authenticate with Google Drive in plugin settings");
        return;
      }
      this.syncIndexFile = new SyncIndexFile(this.app.vault);
      await this.loadSyncState();
      this.syncService = new SyncService(this.settings.vaultId, this.app.vault, this.googleAuthService, this.syncStateManager);
      this.conflictUI = new ConflictUIService(this.app, this.syncService);
      this.conflictUI.onResolution((result) => {
        console.log(`Conflict resolved: ${result.conflictId} -> ${result.resolution}`);
        new import_obsidian6.Notice(`Conflict resolved: ${result.resolution}`);
      });
      this.vaultWatcher = new VaultWatcherService(this.app.vault);
      this.vaultWatcher.onChange(async (change) => {
        if (change.isFolder) {
          console.log(`Folder ${change.changeType}: ${change.filePath}`);
          if (this.syncService && this.settings.autoSync) {
            try {
              switch (change.changeType) {
                case "created":
                  if (change.oldPath) {
                    await this.syncService.handleFolderRename(change.oldPath, change.filePath);
                  } else {
                    await this.syncService.handleFolderCreation(change.filePath);
                  }
                  await this.saveSyncState();
                  break;
                case "deleted":
                  await this.syncService.handleFolderDeletion(change.filePath);
                  await this.saveSyncState();
                  break;
              }
            } catch (error) {
              console.error(`Failed to handle folder ${change.changeType} for ${change.filePath}:`, error);
            }
          }
        } else {
          console.log(`File ${change.changeType}: ${change.filePath}`);
          if (this.syncService && this.settings.autoSync) {
            try {
              switch (change.changeType) {
                case "created":
                  await this.syncService.handleFileCreation(change.filePath);
                  await this.saveSyncState();
                  break;
                case "modified":
                  await this.syncService.handleFileModification(change.filePath);
                  await this.saveSyncState();
                  break;
                case "deleted":
                  await this.syncService.handleFileDeletion(change.filePath);
                  await this.saveSyncState();
                  break;
              }
            } catch (error) {
              console.error(`Failed to handle ${change.changeType} event for ${change.filePath}:`, error);
              this.pendingChanges.add(change.filePath);
            }
          } else {
            this.pendingChanges.add(change.filePath);
          }
        }
        if (this.settings.autoSync && this.pendingChanges.size > 0) {
          this.debouncedSync();
        }
      });
      this.vaultWatcher.startWatching();
      if (this.settings.autoSync) {
        this.startAutoSync();
      }
      this.startRemoteCheck();
      this.startIndexReconciliation();
      this.performInitialSync();
      new import_obsidian6.Notice("Obsidian Sync initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Obsidian Sync:", error);
      new import_obsidian6.Notice("Failed to initialize Obsidian Sync: " + error.message);
    }
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async loadSyncState() {
    if (!this.syncIndexFile) {
      console.error("❌ SyncIndexFile not initialized");
      return;
    }
    const state = await this.syncIndexFile.load();
    if (state) {
      console.log("✅ Loaded sync state from JSON file");
      this.syncStateManager = new SyncStateManager(this.settings.vaultId);
      this.syncStateManager.setState(state);
    } else if (this.settings.syncState) {
      console.log("\uD83D\uDD04 Migrating sync state from plugin data to JSON file...");
      const migratedState = await this.syncIndexFile.migrateFromPluginData(this.settings.syncState);
      this.syncStateManager = new SyncStateManager(this.settings.vaultId);
      this.syncStateManager.setState(migratedState);
      this.settings.syncState = null;
      await this.saveData(this.settings);
      console.log("✅ Migration complete, old format cleared from plugin data");
    } else {
      console.log("\uD83D\uDCDD Initializing new sync state");
      this.syncStateManager = new SyncStateManager(this.settings.vaultId);
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
    await this.initializeGoogleDrive();
    await this.initializeServices();
  }
  async saveSyncState() {
    if (this.syncStateManager && this.syncIndexFile) {
      const state = this.syncStateManager.getState();
      await this.syncIndexFile.save(state);
    }
  }
  async initializeGoogleDrive() {
    if (!this.settings.googleClientId || !this.settings.googleClientSecret) {
      console.log("Google Drive credentials not configured");
      return;
    }
    try {
      this.googleAuthService = new GoogleDriveAuthService(this.settings.googleClientId, this.settings.googleClientSecret);
      if (this.settings.googleTokens) {
        this.googleAuthService.setTokens(this.settings.googleTokens);
        console.log("✅ Google Drive authentication restored from saved tokens");
      }
    } catch (error) {
      console.error("Failed to initialize Google Drive:", error);
      new import_obsidian6.Notice("Failed to initialize Google Drive: " + error.message);
    }
  }
  async startGoogleDriveOAuth() {
    if (!this.googleAuthService) {
      new import_obsidian6.Notice("Please configure Google OAuth credentials first");
      return;
    }
    try {
      const authUrl = this.googleAuthService.getAuthUrl();
      window.open(authUrl, "_blank");
      new import_obsidian6.Notice("Opening Google authentication in browser...");
      await this.startOAuthCallbackServer();
    } catch (error) {
      console.error("OAuth error:", error);
      new import_obsidian6.Notice("Failed to start OAuth: " + error.message);
    }
  }
  async startOAuthCallbackServer() {
    const modal = new OAuthCallbackModal(this.app, async (code) => {
      try {
        if (!this.googleAuthService) {
          throw new Error("Google Auth service not initialized");
        }
        new import_obsidian6.Notice("Exchanging authorization code...");
        const tokens = await this.googleAuthService.exchangeCodeForTokens(code);
        this.settings.googleTokens = tokens;
        await this.saveData(this.settings);
        new import_obsidian6.Notice("✅ Successfully authenticated with Google Drive!");
        console.log("Google Drive authentication successful");
      } catch (error) {
        console.error("Failed to exchange auth code:", error);
        new import_obsidian6.Notice("Authentication failed: " + error.message);
      }
    });
    modal.open();
  }
  isGoogleDriveAuthenticated() {
    return this.googleAuthService?.isAuthenticated() || false;
  }
  async signOutGoogleDrive() {
    if (this.googleAuthService) {
      try {
        await this.googleAuthService.revokeTokens();
        this.settings.googleTokens = null;
        await this.saveData(this.settings);
        new import_obsidian6.Notice("Signed out from Google Drive");
      } catch (error) {
        console.error("Failed to sign out:", error);
        new import_obsidian6.Notice("Failed to sign out: " + error.message);
      }
    }
  }
  debouncedSync() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      if (this.pendingChanges.size > 0) {
        console.log(`Syncing ${this.pendingChanges.size} changed file(s)...`);
        this.syncVault();
      }
    }, 2000);
  }
  startAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.syncTimer = setInterval(() => {
      if (this.pendingChanges.size > 0) {
        console.log(`Auto-sync: ${this.pendingChanges.size} pending change(s)`);
        this.syncVault();
      } else {
        console.log("Auto-sync: No changes, skipping");
      }
    }, this.settings.syncInterval * 1000);
    console.log(`Auto-sync started with ${this.settings.syncInterval}s interval`);
  }
  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }
  startRemoteCheck() {
    if (this.remoteCheckTimer) {
      clearInterval(this.remoteCheckTimer);
    }
    console.log("\uD83D\uDD0D Starting remote check timer (every 2 minutes)...");
    this.remoteCheckTimer = setInterval(async () => {
      console.log("⏰ Remote check timer fired");
      if (!this.syncStateManager || !this.syncService) {
        console.log("  ⚠️ syncStateManager or syncService not initialized, skipping");
        return;
      }
      const needsCheck = this.syncStateManager.needsRemoteCheck(2 * 60 * 1000);
      console.log(`  needsRemoteCheck: ${needsCheck}`);
      if (needsCheck) {
        console.log("  \uD83D\uDD0D Scheduled remote check: Checking for remote changes...");
        try {
          const result = await this.syncService.syncVault();
          if (result.downloadedFiles && result.downloadedFiles > 0) {
            new import_obsidian6.Notice(`Downloaded ${result.downloadedFiles} file(s) from remote`);
          }
        } catch (error) {
          console.error("  ❌ Remote check failed:", error);
        }
      } else {
        console.log("  ⏭️ Remote check: Recently checked, skipping");
      }
    }, 2 * 60 * 1000);
    console.log("✅ Remote check timer started (every 2 minutes)");
  }
  stopRemoteCheck() {
    if (this.remoteCheckTimer) {
      clearInterval(this.remoteCheckTimer);
      this.remoteCheckTimer = null;
    }
  }
  startIndexReconciliation() {
    if (this.indexReconcileTimer) {
      clearInterval(this.indexReconcileTimer);
    }
    console.log("\uD83D\uDCCA Starting index reconciliation timer (every 5 minutes)...");
    this.indexReconcileTimer = setInterval(async () => {
      console.log("⏰ Index reconciliation timer fired");
      if (!this.syncService) {
        console.log("  ⚠️ Sync service not initialized, skipping");
        return;
      }
      try {
        const newFilesFound = await this.syncService.reconcileIndex();
        if (newFilesFound > 0) {
          console.log(`  ✅ Found and uploaded ${newFilesFound} untracked file(s)`);
          new import_obsidian6.Notice(`Found and uploaded ${newFilesFound} untracked file(s)`);
          await this.saveSyncState();
        }
      } catch (error) {
        console.error("  ❌ Index reconciliation failed:", error);
      }
    }, 5 * 60 * 1000);
    setTimeout(async () => {
      if (this.syncService) {
        console.log("\uD83D\uDD0D Running initial index reconciliation...");
        try {
          const newFilesFound = await this.syncService.reconcileIndex();
          if (newFilesFound > 0) {
            console.log(`✅ Initial reconciliation: Found ${newFilesFound} untracked file(s)`);
            await this.saveSyncState();
          }
        } catch (error) {
          console.error("❌ Initial index reconciliation failed:", error);
        }
      }
    }, 5000);
    console.log("✅ Index reconciliation timer started (every 5 minutes)");
  }
  stopIndexReconciliation() {
    if (this.indexReconcileTimer) {
      clearInterval(this.indexReconcileTimer);
      this.indexReconcileTimer = null;
    }
  }
  async performInitialSync() {
    console.log("\uD83D\uDE80 Performing initial sync on startup...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (!this.settings.vaultId) {
      console.log("  ⚠️ Vault ID not set, skipping initial sync");
      return;
    }
    if (!this.syncService) {
      console.log("  ⚠️ Sync service not initialized, skipping initial sync");
      return;
    }
    try {
      console.log("  \uD83D\uDCCA Checking for differences between local and remote...");
      const result = await this.syncService.syncVault();
      if (result.success) {
        if (result.downloadedFiles && result.downloadedFiles > 0) {
          console.log(`  ✅ Initial sync: Downloaded ${result.downloadedFiles} file(s) from remote`);
          new import_obsidian6.Notice(`Initial sync: Downloaded ${result.downloadedFiles} file(s) from remote`);
        } else if (result.uploadedFiles && result.uploadedFiles > 0) {
          console.log(`  ✅ Initial sync: Uploaded ${result.uploadedFiles} file(s) to remote`);
          new import_obsidian6.Notice(`Initial sync: Uploaded ${result.uploadedFiles} file(s) to remote`);
        } else {
          console.log("  ✅ Initial sync: Vault is up to date");
        }
      } else {
        console.error("  ❌ Initial sync failed:", result.message);
      }
    } catch (error) {
      console.error("  ❌ Initial sync error:", error);
    }
  }
  async syncVault() {
    if (!this.settings.vaultId) {
      new import_obsidian6.Notice("Please set a vault ID in the plugin settings");
      return;
    }
    if (!this.syncService) {
      new import_obsidian6.Notice("Sync service not initialized");
      return;
    }
    try {
      new import_obsidian6.Notice("Starting vault sync...");
      const result = await this.syncService.syncVault();
      if (result.success) {
        let message = `Sync completed`;
        if (result.uploadedFiles && result.uploadedFiles > 0) {
          message += ` ↑${result.uploadedFiles}`;
        }
        if (result.downloadedFiles && result.downloadedFiles > 0) {
          message += ` ↓${result.downloadedFiles}`;
        }
        if (result.skippedFiles && result.skippedFiles > 0) {
          message += ` =${result.skippedFiles}`;
        }
        if (result.conflicts && result.conflicts > 0) {
          message += ` ⚠${result.conflicts}`;
        }
        new import_obsidian6.Notice(message);
        this.pendingChanges.clear();
        console.log("Pending changes cleared");
        await this.saveSyncState();
      } else {
        new import_obsidian6.Notice(`Sync failed: ${result.message}`);
      }
    } catch (error) {
      console.error("Sync error:", error);
      new import_obsidian6.Notice("Sync failed: " + error.message);
    }
  }
  onSettingsChange() {
    if (this.settings.autoSync) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }
}

class ObsidianSyncSettingTab extends import_obsidian6.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  async display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Obsidian Sync Settings" });
    containerEl.createEl("p", {
      text: "This plugin syncs your vault directly to Google Drive. No server required!",
      cls: "setting-item-description"
    });
    containerEl.createEl("h3", { text: "Google Drive Configuration" });
    new import_obsidian6.Setting(containerEl).setName("Google Client ID").setDesc("OAuth 2.0 Client ID from Google Cloud Console").addText((text) => text.setPlaceholder("Enter your Google Client ID").setValue(this.plugin.settings.googleClientId).onChange(async (value) => {
      this.plugin.settings.googleClientId = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian6.Setting(containerEl).setName("Google Client Secret").setDesc("OAuth 2.0 Client Secret from Google Cloud Console").addText((text) => {
      text.setPlaceholder("Enter your Google Client Secret").setValue(this.plugin.settings.googleClientSecret).onChange(async (value) => {
        this.plugin.settings.googleClientSecret = value;
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
      return text;
    });
    containerEl.createEl("h3", { text: "Google Drive Authentication" });
    const authStatusSetting = new import_obsidian6.Setting(containerEl).setName("Authentication Status").setDesc(this.plugin.isGoogleDriveAuthenticated() ? "✓ Authenticated with Google Drive" : "✗ Not authenticated");
    if (!this.plugin.isGoogleDriveAuthenticated()) {
      authStatusSetting.addButton((button) => button.setButtonText("Authenticate with Google Drive").setCta().onClick(async () => {
        await this.plugin.startGoogleDriveOAuth();
      }));
    } else {
      authStatusSetting.addButton((button) => button.setButtonText("Sign Out").setWarning().onClick(async () => {
        await this.plugin.signOutGoogleDrive();
        this.display();
      }));
    }
    containerEl.createEl("h3", { text: "Vault Configuration" });
    new import_obsidian6.Setting(containerEl).setName("Vault ID").setDesc("Unique identifier for this vault").addText((text) => text.setPlaceholder("my-vault").setValue(this.plugin.settings.vaultId).onChange(async (value) => {
      this.plugin.settings.vaultId = value;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "Sync Settings" });
    new import_obsidian6.Setting(containerEl).setName("Sync Interval").setDesc("Auto-sync interval in seconds").addSlider((slider) => slider.setLimits(10, 300, 10).setValue(this.plugin.settings.syncInterval).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.syncInterval = value;
      await this.plugin.saveSettings();
      this.plugin.onSettingsChange();
    }));
    new import_obsidian6.Setting(containerEl).setName("Auto Sync").setDesc("Automatically sync on file changes").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
      this.plugin.settings.autoSync = value;
      await this.plugin.saveSettings();
      this.plugin.onSettingsChange();
    }));
    new import_obsidian6.Setting(containerEl).setName("Conflict Resolution").setDesc("How to handle sync conflicts").addDropdown((dropdown) => dropdown.addOption("local", "Keep local version").addOption("remote", "Keep remote version").addOption("manual", "Ask me each time").setValue(this.plugin.settings.conflictResolution).onChange(async (value) => {
      this.plugin.settings.conflictResolution = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian6.Setting(containerEl).setName("Test Connection").setDesc("Test connection to sync server").addButton((button) => button.setButtonText("Test Connection").setCta().onClick(() => {
      this.plugin.testConnection();
    }));
  }
}

class OAuthCallbackModal extends import_obsidian6.Modal {
  callback;
  codeInput;
  constructor(app, callback) {
    super(app);
    this.callback = callback;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Google Drive Authentication" });
    contentEl.createEl("p", {
      text: "After authorizing in your browser, Google will redirect you to a page with an authorization code. Please copy and paste that code here:"
    });
    this.codeInput = contentEl.createEl("input", {
      type: "text",
      placeholder: "Paste authorization code here"
    });
    this.codeInput.style.width = "100%";
    this.codeInput.style.padding = "8px";
    this.codeInput.style.marginTop = "10px";
    this.codeInput.style.marginBottom = "20px";
    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "10px";
    const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
    cancelButton.addEventListener("click", () => {
      this.close();
    });
    const submitButton = buttonContainer.createEl("button", { text: "Submit", cls: "mod-cta" });
    submitButton.addEventListener("click", async () => {
      const code = this.codeInput.value.trim();
      if (code) {
        await this.callback(code);
        this.close();
      } else {
        new import_obsidian6.Notice("Please enter the authorization code");
      }
    });
    this.codeInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        const code = this.codeInput.value.trim();
        if (code) {
          await this.callback(code);
          this.close();
        }
      }
    });
    setTimeout(() => this.codeInput.focus(), 100);
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
