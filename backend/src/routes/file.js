// backend/src/routes/file.js
// Full file manager operations:
// GET  /api/file/list?path=...     — list directory contents
// GET  /api/file/read?path=...     — read file content
// GET  /api/file/download?path=... — download a file
// POST /api/file/write             — write file content
// POST /api/file/mkdir             — create a directory
// POST /api/file/delete            — delete file or directory (recursive)
// POST /api/file/copy             — copy file or directory
// POST /api/file/move             — move/rename file or directory
// POST /api/file/rename           — rename file or directory
// POST /api/file/upload           — upload a file (multipart or base64)

const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { executeTool } = require("../qwen/toolExecutor");
const { audit } = require("../utils/audit");
const { logAction } = require("../utils/actionHistory");
const sandbox = require("../utils/sandbox");

const FILES_ROOT = process.env.FILES_ROOT || "/var/althr-volumes/files";
const SANDBOX_ROOT = sandbox.SANDBOX_VOLUME;

function getActiveRoot() {
  return sandbox.isActive() ? SANDBOX_ROOT : FILES_ROOT;
}

function resolveFilePath(p) {
  if (!p || typeof p !== "string") return null;
  if (sandbox.isActive()) {
    if (p.startsWith(FILES_ROOT)) {
      return p.replace(FILES_ROOT, SANDBOX_ROOT);
    }
    if (p.startsWith(SANDBOX_ROOT)) return p;
    if (p === "/" || p === "") return SANDBOX_ROOT;
  }
  return p;
}

function validatePath(p) {
  if (!p || typeof p !== "string") return null;
  const resolved = path.resolve(p);
  // Allow paths under FILES_ROOT or any absolute path (for server management).
  // Block obvious traversal attempts outside normal ranges.
  if (resolved.includes("..")) return null;
  return resolved;
}

router.get("/list", async (req, res) => {
  const dirPath = resolveFilePath(req.query.path) || getActiveRoot();
  try {
    const result = await executeTool("list_directory", { path: dirPath });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/read", async (req, res) => {
  const filePath = resolveFilePath(req.query.path);
  if (!filePath) return res.status(400).json({ error: "path is required" });
  try {
    const result = await executeTool("read_file", { path: filePath });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/download", async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: "path is required" });
  const safePath = validatePath(filePath);
  if (!safePath) return res.status(400).json({ error: "invalid path" });

  try {
    if (!fs.existsSync(safePath)) return res.status(404).json({ error: "file not found" });
    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) return res.status(400).json({ error: "cannot download a directory" });

    const filename = path.basename(safePath);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", stat.size);
    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/write", async (req, res) => {
  const { path: rawFilePath, content } = req.body || {};
  const filePath = resolveFilePath(rawFilePath);
  if (!filePath || content === undefined) return res.status(400).json({ error: "path and content are required" });

  const user = req.user || { username: "api", role: "admin" };
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for file write" });
  }

  try {
    const result = await executeTool("write_file", { path: filePath, content });
    await audit({ operation: "execute", actor: user.username, target: filePath, target_type: "file", reasoning: "direct file write via API", result: result.ok ? "success" : "failure" });
    logAction({ category: "file", action: "write", target: filePath, actor: user.username, result: result.ok ? "success" : "failure" }).catch(() => {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/mkdir", async (req, res) => {
  const { path: rawDirPath } = req.body || {};
  const dirPath = resolveFilePath(rawDirPath);
  if (!dirPath) return res.status(400).json({ error: "path is required" });

  const user = req.user || { username: "api", role: "admin" };
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for directory creation" });
  }

  try {
    fs.mkdirSync(dirPath, { recursive: true });
    await audit({ operation: "execute", actor: user.username, target: dirPath, target_type: "directory", reasoning: "directory created via API", result: "success" });
    logAction({ category: "file", action: "mkdir", target: dirPath, actor: user.username, result: "success" }).catch(() => {});
    res.json({ ok: true, path: dirPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/delete", async (req, res) => {
  const { path: rawTargetPath } = req.body || {};
  const targetPath = resolveFilePath(rawTargetPath);
  if (!targetPath) return res.status(400).json({ error: "path is required" });

  const user = req.user || { username: "api", role: "admin" };
  if (user.role !== "admin") {
    return res.status(403).json({ error: "insufficient role for delete" });
  }

  try {
    if (!fs.existsSync(targetPath)) return res.status(404).json({ error: "path not found" });
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true });
    } else {
      fs.unlinkSync(targetPath);
    }
    await audit({ operation: "delete", actor: user.username, target: targetPath, target_type: stat.isDirectory() ? "directory" : "file", reasoning: "file deleted via API", result: "success" });
    logAction({ category: "file", action: "delete", target: targetPath, actor: user.username, result: "success" }).catch(() => {});
    res.json({ ok: true, path: targetPath, deleted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/copy", async (req, res) => {
  const { src: rawSrc, dest: rawDest } = req.body || {};
  const src = resolveFilePath(rawSrc);
  const dest = resolveFilePath(rawDest);
  if (!src || !dest) return res.status(400).json({ error: "src and dest are required" });

  const user = req.user || { username: "api", role: "admin" };
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for copy" });
  }

  try {
    if (!fs.existsSync(src)) return res.status(404).json({ error: "source not found" });
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      // Recursive directory copy
      copyDirSync(src, dest);
    } else {
      // Ensure dest directory exists
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    await audit({ operation: "copy", actor: user.username, target: `${src} -> ${dest}`, target_type: "file", reasoning: "file copied via API", result: "success" });
    logAction({ category: "file", action: "copy", target: `${src} -> ${dest}`, actor: user.username, result: "success" }).catch(() => {});
    res.json({ ok: true, src, dest, copied: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/move", async (req, res) => {
  const { src: rawSrc, dest: rawDest } = req.body || {};
  const src = resolveFilePath(rawSrc);
  const dest = resolveFilePath(rawDest);
  if (!src || !dest) return res.status(400).json({ error: "src and dest are required" });

  const user = req.user || { username: "api", role: "admin" };
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for move" });
  }

  try {
    if (!fs.existsSync(src)) return res.status(404).json({ error: "source not found" });
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
    await audit({ operation: "move", actor: user.username, target: `${src} -> ${dest}`, target_type: "file", reasoning: "file moved via API", result: "success" });
    logAction({ category: "file", action: "move", target: `${src} -> ${dest}`, actor: user.username, result: "success" }).catch(() => {});
    res.json({ ok: true, src, dest, moved: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/rename", async (req, res) => {
  const { path: rawOldPath, newName } = req.body || {};
  const oldPath = resolveFilePath(rawOldPath);
  if (!oldPath || !newName) return res.status(400).json({ error: "path and newName are required" });

  const user = req.user || { username: "api", role: "admin" };
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for rename" });
  }

  try {
    if (!fs.existsSync(oldPath)) return res.status(404).json({ error: "path not found" });
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);
    fs.renameSync(oldPath, newPath);
    await audit({ operation: "rename", actor: user.username, target: `${oldPath} -> ${newPath}`, target_type: "file", reasoning: "file renamed via API", result: "success" });
    logAction({ category: "file", action: "rename", target: `${oldPath} -> ${newPath}`, actor: user.username, result: "success" }).catch(() => {});
    res.json({ ok: true, oldPath, newPath, renamed: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/upload", async (req, res) => {
  const { path: rawDestDir, content, filename } = req.body || {};
  const destDir = resolveFilePath(rawDestDir);
  if (!destDir || !filename) return res.status(400).json({ error: "path and filename are required" });

  const user = req.user || { username: "api", role: "admin" };
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for upload" });
  }

  try {
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, filename);
    // content can be base64 or plain text
    if (content && typeof content === "string") {
      // Try base64 decode first; if it fails, write as-is
      try {
        const decoded = Buffer.from(content, "base64");
        // Check if it looks like valid base64 (decodes to something reasonable)
        if (decoded.toString("base64") === content.trim()) {
          fs.writeFileSync(destPath, decoded);
        } else {
          fs.writeFileSync(destPath, content);
        }
      } catch {
        fs.writeFileSync(destPath, content);
      }
    } else {
      return res.status(400).json({ error: "content is required" });
    }
    await audit({ operation: "upload", actor: user.username, target: destPath, target_type: "file", reasoning: "file uploaded via API", result: "success" });
    logAction({ category: "file", action: "upload", target: destPath, actor: user.username, result: "success" }).catch(() => {});
    res.json({ ok: true, path: destPath, uploaded: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper: recursive directory copy
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = router;
