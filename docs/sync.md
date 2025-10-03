
# **A Robust Synchronization Protocol for an Obsidian Plugin**

## **Introduction**

The challenge of maintaining a consistent set of files across multiple, intermittently connected devices is a classic problem in distributed computing. While seemingly straightforward, the task is fraught with subtle complexities that can lead to data loss, corruption, and frustrating user experiences. The development of a custom synchronization plugin for Obsidian, leveraging Google Drive as a central repository, presents an opportunity to engineer a solution that is not only functional but also robust, resilient, and deeply integrated with the Obsidian API. This report moves beyond simplistic approaches to file synchronization and details a comprehensive, production-grade system design. It provides a formal architecture, a deterministic synchronization algorithm, and robust strategies for handling the most challenging aspects of distributed state management, including conflict resolution, deletion propagation, and system stability.

The core of the proposed solution rests on a few fundamental principles. First, it acknowledges the nature of Google Drive as a passive data store, which places the full burden of synchronization intelligence upon the client applications—in this case, the Obsidian plugin itself. Second, it establishes a rigorous, stateful approach to change detection, moving beyond unreliable file modification times to a system based on server-authoritative revision histories and cryptographic hashes. This statefulness is the key to unambiguously identifying and resolving conflicts without data loss. Finally, the design addresses critical failure modes and edge cases, such as the "zombie file" problem and infinite sync loops, with specific, algorithm-driven solutions. This document serves as a complete blueprint, guiding the developer from high-level architectural patterns to the specific Google Drive and Obsidian API calls required for implementation, ensuring the final tool is both powerful and trustworthy.

## **Section 1: Foundational Architecture \- A "Passive Hub, Intelligent Spokes" Model**

The selection of an appropriate architectural pattern is the most critical initial decision, as it dictates the responsibilities of each component and the flow of information within the system. Given the use of Google Drive, a generic cloud storage service, the optimal design is a "Passive Hub, Intelligent Spokes" model, a specialized variant of the traditional client-server architecture.1

### **1.1 Defining the Architectural Pattern**

In this model, the "hub" is Google Drive. It serves as the central, canonical repository for all synchronized files—the single source of truth.4 However, it is considered "passive" because it does not actively participate in the synchronization logic. The Google Drive API provides primitives for storing and retrieving files and their metadata, but it does not offer services for delta calculation, conflict resolution, or orchestrated sync sessions.6

The "spokes" are the instances of the custom sync plugin running within Obsidian on each of the user's devices (desktop, laptop, mobile). These clients are "intelligent" because they contain the entirety of the synchronization logic. Each client is independently responsible for reconciling its local state with the state of the hub, and by extension, with all other clients. This stands in contrast to peer-to-peer models, where devices may communicate directly, or enterprise three-way sync systems that employ an active central orchestrator to manage data flows and resolve conflicts.7 The constraint of a passive hub elevates the importance of the client-side logic and its ability to maintain a historical context of the synchronized state. Without this context, every synchronization attempt would be a blind, stateless comparison, making robust conflict detection and the prevention of stale overwrites impossible.

### **1.2 The Local State Index: The Plugin's Memory**

To enable intelligent, stateful synchronization, the plugin must maintain a persistent, local database that acts as its memory of the last known synchronized state. This "Local State Index" formalizes the user's existing concept of a local index and is the most critical data structure in the entire system. Within the Obsidian plugin environment, this is best implemented as a JSON object stored in the plugin's dedicated data file (data.json).27 The Obsidian API provides convenient methods,

this.loadData() and this.saveData(), to manage this file, abstracting away the filesystem details.28

The integrity of this index is paramount. It transforms the synchronization process from a simple two-way comparison (local vs. remote) into a more sophisticated three-way analysis: the last known common state, the current local state, and the current remote state. This three-point comparison is the foundation upon which reliable conflict detection is built.

#### **1.2.1 Schema Definition**

Each record in the Local State Index corresponds to a file being tracked by the sync plugin and must contain the following fields:

* filePath: The relative path of the note within the local Obsidian vault (e.g., notes/ProjectX/Meeting\_Notes.md). This is used to locate the file on the local filesystem via the Vault API.  
* fileId: The unique and immutable ID assigned by the Google Drive API when the file was first created.9 This serves as the unwavering link between the local file and its remote counterpart, even if the file is renamed or moved.  
* lastSyncRevisionId: The headRevisionId of the Google Drive file as it existed at the conclusion of the last successful sync operation involving this file.10 This field is the client's record of the specific server version it is in sync with.  
* lastSyncHash: The cryptographic hash (e.g., SHA-256) of the *local* file's content, calculated at the same time lastSyncRevisionId was recorded. This provides a fast and reliable way to detect if the local file has been modified since the last sync, without needing to re-read the entire file content on every check.  
* lastModifiedTime: The local file's modification timestamp provided by the operating system. While notoriously unreliable for comparing changes across different devices due to clock drift and timezone issues 12, it serves as an efficient, low-cost heuristic. A change in this timestamp can trigger the more expensive hash calculation to definitively confirm a local modification.

### **1.3 The Server State Snapshot: A Point-in-Time View of Truth**

At the beginning of each full synchronization cycle, the plugin must construct a complete, up-to-date picture of the remote repository. This is not a persistent entity but rather a transient, in-memory data structure referred to as the "Server State Snapshot."

#### **1.3.1 Generation Process**

The plugin generates this snapshot by querying the Google Drive API to list all files and their relevant metadata within the target synchronization folder. All network requests must be made using Obsidian's requestUrl() function to ensure they work across desktop and mobile platforms by bypassing CORS restrictions.30 While a naive implementation might perform a recursive listing of the folder contents, a far more efficient method is to leverage the

changes.list API endpoint, which provides a chronological log of all modifications, creations, and deletions (detailed further in Section 5).10

#### **1.3.2 Schema Definition**

The snapshot is effectively a map or dictionary where the key is the Google Drive fileId. Each entry in this map contains the essential metadata required for the reconciliation algorithm:

* remoteRevisionId: The current headRevisionId of the file on Google Drive. This is the server's authoritative version identifier.10  
* remotePath: The current full path of the file within the Google Drive folder. This is used to detect remote renames or moves.  
* remoteMetadata: A placeholder for any other relevant metadata, such as custom appProperties, which will be used for implementing advanced features like infinite loop prevention and deletion tracking.

With the persistent Local State Index and the transient Server State Snapshot defined, the plugin has all the information necessary to execute the core synchronization protocol.

## **Section 2: The Core Synchronization Algorithm \- A Three-Phase Protocol**

The heart of the synchronization plugin is a deterministic, multi-phase algorithm that systematically compares states, transfers data, and commits the new state. This protocol ensures that every file is correctly categorized and processed, leading to a consistent state across all devices.

### **2.1 Phase 1: State Reconciliation**

In this initial phase, the plugin performs a comprehensive comparison of the Local State Index, the actual state of the local filesystem (accessed via the Obsidian Vault API), and the newly generated Server State Snapshot. The objective is to sort every file into a specific action category, forming a clear execution plan for the subsequent phases. The power of this reconciliation process stems from its use of three data points for every decision: the last known synchronized state (from the index), the current local state (from the filesystem), and the current remote state (from the API). Simpler sync tools often omit the first data point, which prevents them from reliably distinguishing between a single, safe change and two independent, conflicting changes.

#### **2.1.1 Algorithm Pseudocode (with Obsidian API context)**

The following pseudocode outlines the decision-making logic, noting the relevant Obsidian API calls.

// Initialize action sets  
filesToUpload \=  
filesToDownload \=  
filesInConflict \=  
filesToRenameLocally \=  
filesToRenameRemotely \=  
deletionsToProcess \=

// Load the Local State Index from data.json  
localStateIndex \= await this.loadData()

// 1\. Process files known from the last sync (present in Local State Index)  
for localEntry in localStateIndex:  
    // Check for remote deletion  
    if not ServerStateSnapshot.contains(localEntry.fileId):  
        deletionsToProcess.add(localEntry)  
        continue

    serverEntry \= ServerStateSnapshot.get(localEntry.fileId)  
      
    // Use Obsidian API to check local file existence  
    localFile \= this.app.vault.getAbstractFileByPath(localEntry.filePath)  
      
    if not localFile:  
        // Local file was deleted. This is handled separately (see Section 4.2).  
        continue

    // Detect local and remote changes  
    // Use adapter.readBinary for hashing non-text files  
    fileData \= await this.app.vault.adapter.readBinary(localEntry.filePath)  
    currentLocalHash \= calculate\_hash(fileData)  
    localHasChanged \= (currentLocalHash\!= localEntry.lastSyncHash)  
    remoteHasChanged \= (serverEntry.remoteRevisionId\!= localEntry.lastSyncRevisionId)

    // Decision Tree for file state  
    if localHasChanged and not remoteHasChanged:  
        filesToUpload.add(localEntry)  
    elif not localHasChanged and remoteHasChanged:  
        filesToDownload.add(localEntry)  
    elif localHasChanged and remoteHasChanged:  
        filesInConflict.add(localEntry)  
    elif not localHasChanged and not remoteHasChanged:  
        // Content is identical, check for metadata changes like path  
        if localEntry.filePath\!= serverEntry.remotePath:  
            filesToRenameLocally.add(localEntry, newPath=serverEntry.remotePath)  
    // else: No changes, do nothing.

// 2\. Process new remote files (in Snapshot but not in Index)  
for serverEntry in ServerStateSnapshot:  
    if not localStateIndex.contains(serverEntry.fileId):  
        filesToDownload.add(serverEntry)

// 3\. Process new local files (on filesystem but not in Index)  
// Use Obsidian API to list all files in the vault  
allVaultFiles \= this.app.vault.getFiles()  
for localFile in allVaultFiles:  
    if not localStateIndex.containsPath(localFile.path):  
        filesToUpload.add(new\_entry\_for(localFile.path))

### **2.2 Phase 2: Optimized Data Transfer**

Once the reconciliation phase has produced a complete plan, the plugin executes the necessary data transfer and metadata update operations using the Obsidian Vault API for local changes and requestUrl for remote ones.30

For Obsidian notes, which are typically small text files, a full upload or download is simpler to implement and sufficiently performant. However, should the user store large attachments, implementing a delta-transfer mechanism based on rsync principles would be a valuable future optimization.14

The order of operations is critical to avoid race conditions. The plugin should execute actions in the following sequence:

1. **Process Renames:** Apply renames using this.app.vault.rename(file, newPath).31  
2. **Process Deletions:** Handle deletions using this.app.vault.trash(file, true) for system trash or this.app.vault.delete(file) for permanent removal.32  
3. **Execute Downloads:** Transfer files from Google Drive and write them locally using this.app.vault.createBinary() or this.app.vault.modifyBinary().31  
4. **Execute Uploads:** Read local files with this.app.vault.adapter.readBinary() and upload to Google Drive.33  
5. **Handle Conflicts:** Execute the conflict resolution strategy (see Section 4.1).

### **2.3 Phase 3: Post-Sync State Committal**

This final phase is crucial for robustness. After each individual file operation in Phase 2 completes successfully, the Local State Index must be updated immediately and atomically for that file using this.saveData().27 This prevents the system from having to re-process completed transfers if the sync is interrupted.

#### **2.3.1 Atomic Update Logic**

* **After a successful upload**: The plugin receives a response from the Google Drive API containing the new headRevisionId. It must immediately update the corresponding entry in the Local State Index and commit it to disk with this.saveData().  
* **After a successful download**: The plugin updates the local index entry with the remoteRevisionId of the downloaded version and the calculated hash of the new local file content, then calls this.saveData().  
* **After a successful local rename**: The plugin updates the filePath field in the index and calls this.saveData().

By committing state changes on a per-file basis, the synchronization process becomes idempotent and resilient.

## **Section 3: Triggering Synchronization \- Balancing Immediacy and Efficiency**

Determining *when* to initiate a synchronization cycle is a critical design decision that directly impacts user experience, network usage, and device battery life.15 The optimal solution for an Obsidian plugin is a hybrid model that combines multiple trigger types.

### **3.1 Event-Driven Triggers (Real-time): Using Obsidian's Vault Events**

To provide immediate feedback, the plugin should react to local file changes in real-time. This is achieved using the Obsidian Vault's built-in event system, which abstracts away the complexities of native filesystem watchers.34 The plugin can subscribe to these events:

* this.app.vault.on('create', (file) \=\> {... })  
* this.app.vault.on('modify', (file) \=\> {... })  
* this.app.vault.on('delete', (file) \=\> {... })  
* this.app.vault.on('rename', (file, oldPath) \=\> {... }) 31

All event handlers should be registered using this.registerEvent() to ensure they are properly cleaned up when the plugin is disabled or Obsidian is closed.34

A significant challenge is the phenomenon of "event storms," where a single save action generates multiple events.16 To manage this, the plugin must implement

**debouncing and coalescing** logic. When a file change event is received, a short timer (e.g., 2-5 seconds) is started or reset. When the timer elapses, a lightweight, targeted sync is triggered for the queued files.

### **3.2 Time-Driven Triggers (Periodic): Reliable Server Polling**

To reliably detect changes made on other devices, the plugin must periodically poll the server. This is the backbone of the synchronization strategy. This can be implemented using window.setInterval(), ensuring it is registered with this.registerInterval() for proper cleanup on unload.34 This polling should use the efficient

changes.list Google Drive API endpoint and trigger the full three-phase synchronization algorithm.10 A polling interval of 5 to 10 minutes is a reasonable starting point.15

### **3.3 Manual Triggers: User-Initiated Sync**

Providing the user with direct control is essential for building trust. A "Sync Now" command can be added to the Obsidian Command Palette using this.addCommand() or as a button in the left ribbon using this.addRibbonIcon().28 This manual trigger gives the user the agency to force a full synchronization cycle on demand.17

### **3.4 The Recommended Hybrid Model**

The most effective strategy is a hybrid approach that combines the strengths of all three triggers:

* **For Local Changes:** The debounced Vault event listeners provide a low-latency, real-time user experience.  
* **For Remote Changes:** Periodic polling provides a reliable, low-overhead mechanism for discovering remote changes.  
* **For Robustness and Control:** The periodic poll also acts as a self-healing mechanism, catching any local changes the event listeners might have missed. The manual trigger provides an essential override for the user.

| Trigger Type | Data Latency | Network Usage | CPU/Battery Impact | Implementation Complexity | Key Advantage | Key Pitfall |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Event-Driven (Vault Events)** | Very Low (Seconds) | Low (per event) | Low (event-driven) | Medium | Instantaneous feedback for local changes | Requires careful debouncing logic |
| **Time-Driven (Polling)** | Medium (Minutes) | Very Low (with changes.list) | Low (periodic spikes) | Medium | Highly reliable for detecting all remote changes | Inherent delay in discovering remote changes 15 |
| **Manual (Command/Icon)** | High (User-dependent) | Variable | Variable | Low | Provides user control and confidence | Not automatic; relies on user action 17 |
| **Recommended Hybrid Model** | Low (Blended) | Low (Optimized) | Low (Balanced) | High | Combines real-time feel with guaranteed reliability | Most complex to implement and test correctly |

## **Section 4: Advanced Problem Solving \- Ensuring Data Integrity and Robustness**

A truly robust synchronization system is defined by how it handles failure modes and edge cases. This section addresses the most critical challenges: resolving conflicting edits, propagating deletions without error, and preventing the system from entering unstable states like infinite loops.

### **4.1 Conflict Detection and Resolution**

The most severe failure mode for a sync tool is silent data loss, which often occurs when conflicting edits are resolved improperly.

#### **4.1.1 Formal Definition of a Conflict**

A conflict occurs if, and only if, a file has been modified independently on both the local device AND on the server since the last commonly agreed-upon version. This state is unambiguously detected during Phase 1 of the core algorithm when the following conditions are both true for a given file:

1. The hash of the current local file does not match the lastSyncHash stored in the Local State Index.  
2. The headRevisionId of the remote file does not match the lastSyncRevisionId stored in the Local State Index.

#### **4.1.2 Conflict Resolution Strategies**

* **Last Write Wins (LWW):** This approach, where one version overwrites the other, is highly discouraged as it guarantees data loss and is not a true conflict resolution strategy.18  
* **Conflicted Copy (Recommended):** This strategy prioritizes data preservation above all else, as used by services like Dropbox . When a conflict is detected, the system preserves both versions, allowing the user to merge them manually.

The algorithm for implementing the "Conflicted Copy" strategy within an Obsidian plugin is as follows:

1. Upon detecting a conflict for a file (e.g., note.md), the plugin does not overwrite any existing file.  
2. The plugin first downloads the server's version. Instead of overwriting, it saves it locally using this.app.vault.createBinary() under a new name, such as note (conflicted copy from Desktop on 2023-10-27).md.31  
3. Next, the plugin proceeds with its original plan to upload its local version of note.md.  
4. Finally, the plugin updates its Local State Index for note.md and creates a *new* entry for the conflicted copy file, treating it as a new local file to be uploaded on the next sync cycle.

This process ensures both sets of edits are preserved. The user can then use Obsidian's built-in file comparison or a community plugin with a diff view to merge the changes manually.36

| Strategy | Data Safety | User Experience | Automation Level | Implementation Complexity |
| :---- | :---- | :---- | :---- | :---- |
| **Last Write Wins (LWW)** | Low (Guaranteed Data Loss) | Poor (Changes disappear silently) | High (Fully automated) | Low |
| **Conflicted Copy** | High (Zero Data Loss) | Good (User is notified and empowered) | Medium (Requires manual merge) | Medium |

### **4.2 Propagating Deletions with Tombstones**

Handling deletions in a distributed system is deceptively complex and can lead to a "zombie file" problem where deleted files are resurrected by offline clients.21 The solution is to treat deletion as a state change using a "tombstone" or "soft delete" mechanism.24

#### **4.2.1 Tombstone Implementation with Google Drive API**

Since Google Drive lacks a native tombstone feature, it must be implemented at the application layer using file metadata.

1. **Central Metadata File:** The plugin designates a single, hidden file in the plugin's configuration directory (e.g., .obsidian/plugins/your-plugin-name/sync-tombstones.json). This file can be accessed using this.app.vault.adapter.read() and write().33  
2. **Creating a Tombstone:** When a user deletes a file locally (detected via vault.on('delete')), the plugin does *not* immediately delete the file on Google Drive. Instead, it adds a tombstone entry (the file's fileId and a timestamp) to the sync-tombstones.json file and uploads this file to a shared location on Google Drive.  
3. **Processing Tombstones:** During Phase 1, every plugin instance downloads and reads the central tombstone file. If it finds a tombstone for a file that still exists locally, it knows to delete its local copy using this.app.vault.trash().  
4. **Garbage Collection:** The actual file on Google Drive is only permanently removed after a "grace period" (e.g., 30 days).22 Any client, upon seeing a tombstone older than the grace period, can safely issue the final  
   files.delete API call and remove the tombstone entry.

### **4.3 Preventing Infinite Sync Loops**

An infinite sync loop is a catastrophic failure mode where clients endlessly pass the same change back and forth, often because a client misinterprets its own update as a new external change.26 The solution is to enable clients to recognize their own changes.

#### **4.3.1 Sync Agent Identity Algorithm**

1. **Generate a Unique ID:** On first run, the plugin generates a universally unique identifier (UUID) and stores it persistently in its data.json settings file using this.saveData().27 This is its  
   syncAgentId.  
2. **Tagging Uploads:** Whenever the plugin uploads a file, it includes its syncAgentId in the request's appProperties field.  
3. **Verifying Downloads:** When the plugin detects a remote change, it first fetches the file's appProperties.  
4. **Ignoring Echoes:** If the lastModifiedByAgent property matches the plugin's *own* syncAgentId, it recognizes the change as an "echo" of its own modification and ignores it, breaking the loop.29

## **Section 5: A Practical Guide to the Google Drive API**

Translating the preceding algorithms into practice requires a precise understanding of the Google Drive API v3. All API calls from the Obsidian plugin must use the requestUrl() function to ensure cross-platform compatibility.30

### **5.1 Efficient Change Detection with changes.list**

Periodic polling is made highly efficient by avoiding a full file listing. The changes.list endpoint provides a "change log" that is the cornerstone of this efficiency.10

#### **5.1.1 Step-by-Step Implementation Guide**

1. **Initial Setup (First-Time Sync):** The plugin calls changes.getStartPageToken to get a startPageToken representing the current state of the Drive folder. This token must be stored persistently in the plugin's data.json file.  
2. **Subsequent Sync Cycles:** The plugin calls changes.list, passing the stored pageToken. The API returns a list of all Change resources that have occurred since that token was generated.10  
3. **Processing the Change List:** The plugin iterates through the changes to update its Server State Snapshot efficiently.  
4. **Updating the Page Token:** The response contains a newStartPageToken. The plugin must persist this new token in its data.json file, overwriting the old one, for the next sync cycle.

### **5.2 Reliable Version Tracking with headRevisionId**

Modification timestamps are unreliable.13 The definitive, server-authoritative identifier for a specific version of a file's content is the

headRevisionId field.10 When a file is uploaded, the API response includes the new

headRevisionId. This is the value that must be captured and stored in the Local State Index as lastSyncRevisionId. Comparing the stored lastSyncRevisionId with the current headRevisionId from the server is the most robust method for detecting remote changes.

### **5.3 Storing Custom Metadata with appProperties**

The Google Drive API allows applications to store custom, hidden key-value metadata on a file using the appProperties field.6 This is the perfect mechanism for storing the internal state required by the advanced algorithms in Section 4\.

* **Usage for Infinite Loop Prevention:** When updating a file, the plugin includes the appProperties field in the files.update request body to tag the update with its syncAgentId.  
  * Example Request Body (partial): { "appProperties": { "lastModifiedByAgent": "uuid-for-client-A" } }  
* **Usage for Tombstones:** When deleting a file, the plugin uses files.update on a central metadata file in Drive, adding a new key to its appProperties.  
  * Example Request Body (partial): { "appProperties": { "tombstone\_1aBcDeF...": "1698432100",... } }  
* **Reading Metadata:** To read these properties, the plugin issues a files.get request, using the fields query parameter to specify that appProperties should be included in the response, avoiding unnecessary data downloads.  
  * Example Request: GET https://www.googleapis.com/drive/v3/files/fileId?fields=id,name,headRevisionId,appProperties

By correctly leveraging these specific API features, the abstract synchronization protocol can be implemented in a way that is both correct and highly efficient within the Obsidian plugin environment.

## **Conclusion**

The design and algorithm presented in this report constitute a comprehensive and resilient framework for a custom file synchronization plugin for Obsidian. By adopting the "Passive Hub, Intelligent Spokes" architecture, the system correctly places the burden of logic on the plugin, a necessity when using a generic cloud storage provider like Google Drive. The foundation of this intelligence is the Local State Index, managed via Obsidian's loadData/saveData API, which enables a stateful, three-point comparison that provides a definitive method for change and conflict detection.

The core of the system—a three-phase protocol of reconciliation, transfer, and committal—is tightly integrated with Obsidian's Vault and Adapter APIs for all local file operations. This is complemented by a hybrid triggering model that combines the real-time responsiveness of Obsidian's built-in vault.on() events with the guaranteed reliability of periodic polling, providing an optimal user experience without compromising robustness.

Crucially, this design directly confronts and solves the most difficult challenges in file synchronization. It rejects the data-loss-prone "Last Write Wins" strategy in favor of the professional "Conflicted Copy" approach. It implements a robust "Tombstone" mechanism to propagate deletions correctly. Finally, it breaks potential infinite sync loops by using a sync agent identity marker. By translating these advanced concepts into a practical implementation guide using specific features of both the Obsidian and Google Drive APIs, this report provides a complete blueprint for building a sync plugin that is not merely functional, but verifiably correct and trustworthy.

#### **Works cited**

1. Understanding Client-Server Architecture Basics \- SynchroNet, accessed October 3, 2025, [https://synchronet.net/client-server-architecture/](https://synchronet.net/client-server-architecture/)  
2. Client–server model \- Wikipedia, accessed October 3, 2025, [https://en.wikipedia.org/wiki/Client%E2%80%93server\_model](https://en.wikipedia.org/wiki/Client%E2%80%93server_model)  
3. Client-Server Architecture Explained with Examples, Diagrams, and Real-World Applications | by Harsh Gupta | Nerd For Tech | Medium, accessed October 3, 2025, [https://medium.com/nerd-for-tech/client-server-architecture-explained-with-examples-diagrams-and-real-world-applications-407e9e04e2d1](https://medium.com/nerd-for-tech/client-server-architecture-explained-with-examples-diagrams-and-real-world-applications-407e9e04e2d1)  
4. Data synchronization \- Wikipedia, accessed October 3, 2025, [https://en.wikipedia.org/wiki/Data\_synchronization](https://en.wikipedia.org/wiki/Data_synchronization)  
5. Client-server synchronization pattern / algorithm? \- Stack Overflow, accessed October 3, 2025, [https://stackoverflow.com/questions/413086/client-server-synchronization-pattern-algorithm](https://stackoverflow.com/questions/413086/client-server-synchronization-pattern-algorithm)  
6. Google Drive API overview, accessed October 3, 2025, [https://developers.google.com/workspace/drive/api/guides/about-sdk](https://developers.google.com/workspace/drive/api/guides/about-sdk)  
7. 3-Way Sync vs 2-Way: What Really Matters in AI Projects \- Boost.space, accessed October 3, 2025, [https://boost.space/blog/3-way-sync-vs-2-way-what-really-matters-in-ai-projects/](https://boost.space/blog/3-way-sync-vs-2-way-what-really-matters-in-ai-projects/)  
8. Is 3-Way Sync possible? : r/Syncthing \- Reddit, accessed October 3, 2025, [https://www.reddit.com/r/Syncthing/comments/i8ppor/is\_3way\_sync\_possible/](https://www.reddit.com/r/Syncthing/comments/i8ppor/is_3way_sync_possible/)  
9. How to overwrite existing file content using Google Drive API while preserving file ID?, accessed October 3, 2025, [https://community.latenode.com/t/how-to-overwrite-existing-file-content-using-google-drive-api-while-preserving-file-id/32169](https://community.latenode.com/t/how-to-overwrite-existing-file-content-using-google-drive-api-while-preserving-file-id/32169)  
10. Changes and revisions overview | Google Drive | Google for ..., accessed October 3, 2025, [https://developers.google.com/workspace/drive/api/guides/change-overview](https://developers.google.com/workspace/drive/api/guides/change-overview)  
11. Manage file revisions | Google Drive, accessed October 3, 2025, [https://developers.google.com/workspace/drive/api/guides/manage-revisions](https://developers.google.com/workspace/drive/api/guides/manage-revisions)  
12. What algorithms are used for file sync (like Dropbox)? : r/AskComputerScience \- Reddit, accessed October 3, 2025, [https://www.reddit.com/r/AskComputerScience/comments/s6dvwl/what\_algorithms\_are\_used\_for\_file\_sync\_like/](https://www.reddit.com/r/AskComputerScience/comments/s6dvwl/what_algorithms_are_used_for_file_sync_like/)  
13. Timestamp-based conflict resolution without reliable time synchronization \- Stack Overflow, accessed October 3, 2025, [https://stackoverflow.com/questions/18505299/timestamp-based-conflict-resolution-without-reliable-time-synchronization](https://stackoverflow.com/questions/18505299/timestamp-based-conflict-resolution-without-reliable-time-synchronization)  
14. Rsync Algorithm \- System Design \- GeeksforGeeks, accessed October 3, 2025, [https://www.geeksforgeeks.org/system-design/rsync-algorithm-system-design/](https://www.geeksforgeeks.org/system-design/rsync-algorithm-system-design/)  
15. Comparing Real-Time vs. Batch Synchronization for CRM Data ..., accessed October 3, 2025, [https://www.stacksync.com/blog/comparing-real-time-vs-batch-synchronization-for-crm-data-when-each-makes-sense](https://www.stacksync.com/blog/comparing-real-time-vs-batch-synchronization-for-crm-data-when-each-makes-sense)  
16. Monitoring Folders for File Changes \- powershell.one, accessed October 3, 2025, [https://powershell.one/tricks/filesystem/filesystemwatcher](https://powershell.one/tricks/filesystem/filesystemwatcher)  
17. ArgoCD Sync Policies: A Practical Guide | Codefresh, accessed October 3, 2025, [https://codefresh.io/learn/argo-cd/argocd-sync-policies-a-practical-guide/](https://codefresh.io/learn/argo-cd/argocd-sync-policies-a-practical-guide/)  
18. Conflict resolution strategies in Data Synchronization | by Mobterest Studio \- Medium, accessed October 3, 2025, [https://mobterest.medium.com/conflict-resolution-strategies-in-data-synchronization-2a10be5b82bc](https://mobterest.medium.com/conflict-resolution-strategies-in-data-synchronization-2a10be5b82bc)  
19. What is Sync? \- Stack by Convex, accessed October 3, 2025, [https://stack.convex.dev/sync](https://stack.convex.dev/sync)  
20. Concurrency and automatic conflict resolution \- codecentric AG, accessed October 3, 2025, [https://www.codecentric.de/en/knowledge-hub/blog/concurrency-and-automatic-conflict-resolution](https://www.codecentric.de/en/knowledge-hub/blog/concurrency-and-automatic-conflict-resolution)  
21. Tombstone (data store) \- Wikipedia, accessed October 3, 2025, [https://en.wikipedia.org/wiki/Tombstone\_(data\_store)](https://en.wikipedia.org/wiki/Tombstone_\(data_store\))  
22. Delete data | DataStax Enterprise, accessed October 3, 2025, [https://docs.datastax.com/en/dse/6.9/architecture/database-internals/about-deletes.html](https://docs.datastax.com/en/dse/6.9/architecture/database-internals/about-deletes.html)  
23. Tombstones | Apache Cassandra Documentation, accessed October 3, 2025, [https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/compaction/tombstones.html)  
24. Tombstone Record \- QuestDB, accessed October 3, 2025, [https://questdb.com/glossary/tombstone-record/](https://questdb.com/glossary/tombstone-record/)  
25. Tombstones \- Design Gurus, accessed October 3, 2025, [https://www.designgurus.io/course-play/grokking-the-advanced-system-design-interview/doc/tombstones](https://www.designgurus.io/course-play/grokking-the-advanced-system-design-interview/doc/tombstones)  
26. How to prevent infinite loops in bi-directional data syncs | Workato ..., accessed October 3, 2025, [https://www.workato.com/product-hub/how-to-prevent-infinite-loops-in-bi-directional-data-syncs/](https://www.workato.com/product-hub/how-to-prevent-infinite-loops-in-bi-directional-data-syncs/)  
27. saveData \- Developer Documentation \- Obsidian Developer Docs, accessed October 3, 2025, [https://docs.obsidian.md/Reference/TypeScript+API/Plugin/saveData](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/saveData)  
28. Plugin \- Developer Documentation \- Obsidian Developer Docs, accessed October 3, 2025, [https://docs.obsidian.md/Reference/TypeScript+API/Plugin](https://docs.obsidian.md/Reference/TypeScript+API/Plugin)  
29. Type definitions for the latest Obsidian API. \- GitHub, accessed October 3, 2025, [https://github.com/obsidianmd/obsidian-api](https://github.com/obsidianmd/obsidian-api)  
30. Interceptors in the Obsidian API \- Developers: Plugin & API, accessed October 3, 2025, [https://forum.obsidian.md/t/interceptors-in-the-obsidian-api/68434](https://forum.obsidian.md/t/interceptors-in-the-obsidian-api/68434)  
31. Vault \- Developer Documentation, accessed October 3, 2025, [https://docs.obsidian.md/Reference/TypeScript+API/Vault](https://docs.obsidian.md/Reference/TypeScript+API/Vault)  
32. Vault \- Developer Documentation, accessed October 3, 2025, [https://docs.obsidian.md/Plugins/Vault](https://docs.obsidian.md/Plugins/Vault)  
33. Is it possible to create a file inside .obsidian folder? \- Developers: Plugin & API, accessed October 3, 2025, [https://forum.obsidian.md/t/is-it-possible-to-create-a-file-inside-obsidian-folder/88072](https://forum.obsidian.md/t/is-it-possible-to-create-a-file-inside-obsidian-folder/88072)  
34. Events \- Developer Documentation \- Obsidian Developer Docs, accessed October 3, 2025, [https://docs.obsidian.md/Plugins/Events](https://docs.obsidian.md/Plugins/Events)  
35. List of all events? \- Developers: Plugin & API \- Obsidian Forum, accessed October 3, 2025, [https://forum.obsidian.md/t/list-of-all-events/93218](https://forum.obsidian.md/t/list-of-all-events/93218)  
36. \[Feature Request\] Conflict Handling to Help with Multi-Device Usage ..., accessed October 3, 2025, [https://github.com/Vinzent03/obsidian-git/issues/803](https://github.com/Vinzent03/obsidian-git/issues/803)  
37. Robust Sync Conflict Resolution \- Help \- Obsidian Forum, accessed October 3, 2025, [https://forum.obsidian.md/t/robust-sync-conflict-resolution/93544](https://forum.obsidian.md/t/robust-sync-conflict-resolution/93544)  
38. How can I access files within my plugin folder \- Developers \- Obsidian Forum, accessed October 3, 2025, [https://forum.obsidian.md/t/how-can-i-access-files-within-my-plugin-folder/89561](https://forum.obsidian.md/t/how-can-i-access-files-within-my-plugin-folder/89561)