

# Fix: Upload 500 Error — "Received undefined"

## Root Cause

This is a **backend (server) issue**, not a frontend problem. The frontend is correctly sending the file via `FormData` to `https://api.kareemsamman.com/upload`.

The error `"The first argument must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object. Received undefined"` originates from `fs.readFileSync(filePath)` in `server/src/services/aps-oss.ts:49`, where `filePath` is `undefined`.

This means `req.file.path` is `undefined` after multer processes the upload. Two likely causes:

1. **The `uploads/` directory doesn't exist** on the deployed server — multer's `diskStorage` fails silently and doesn't populate `req.file.path`.
2. **The server is deployed on a read-only filesystem** (e.g., serverless/containerized) where multer can't write to disk.

## Fix (Server-Side)

### Step 1: Ensure `uploads/` directory is created at startup
In `server/src/index.ts` (or at the top of the routes file), add:
```typescript
import fs from "node:fs";
const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
```

### Step 2: Add a guard in the upload route
In `server/src/routes/dwg.ts`, after the `if (!req.file)` check, add a guard for `req.file.path`:
```typescript
if (!req.file.path) {
  res.status(500).json({ error: "File was not saved to disk. Check server write permissions and uploads directory." });
  return;
}
```

### Step 3: Switch to memory storage as fallback (optional)
If the server runs in a read-only environment, switch multer from `diskStorage` to `memoryStorage` and pass the buffer directly to `uploadObject` instead of a file path. This requires modifying `uploadObject` to accept a `Buffer` in addition to a file path.

## What Changes in the Codebase

| File | Change |
|---|---|
| `server/src/routes/dwg.ts` | Add `mkdirSync` for uploads dir at module load; add `req.file.path` guard |
| `server/src/services/aps-oss.ts` | Update `uploadObject` to accept `Buffer | string` so it works with both disk and memory storage |

These are server-side changes that need to be deployed to `api.kareemsamman.com`.

