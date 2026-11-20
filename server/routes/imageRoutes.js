const express = require("express");
const sharp = require("sharp");
const { randomUUID } = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const protect = require("../middleware/authMiddleware");
const storage = require("../utils/imageStorage");
const images = require("../models/imageModel");

const router = express.Router({ mergeParams: true });
const maxBytes = 5 * 1024 * 1024;
const formats = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const parseImage = express.raw({ type: "application/octet-stream", limit: maxBytes, inflate: false });

function metadata(row) {
  return { id: row.id, filename: row.filename, contentType: row.content_type, size: row.size_bytes };
}

router.use(protect, (req, res, next) => {
  if (!/^[1-9][0-9]{0,9}$/.test(req.params.id)) return res.status(404).json({ message: "Task not found." });
  res.set("Cache-Control", "no-store");
  next();
});

router.get("/", async (req, res, next) => {
  if (!storage.enabled()) return res.json({ enabled: false, image: null });
  try {
    const row = await images.lookup(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ message: "Task not found." });
    return res.json({ enabled: true, image: row.id ? metadata(row) : null });
  } catch (error) { next(error); }
});

router.get("/content/:imageId", async (req, res, next) => {
  try {
    const row = storage.enabled() && await images.lookup(req.user.id, req.params.id);
    if (!row?.id || row.id !== req.params.imageId) return res.status(404).json({ message: "Image not found." });
    const object = await storage.get(row.storage_key);
    res.set({ "Content-Type": row.content_type, "X-Content-Type-Options": "nosniff" });
    await pipeline(object.Body, res);
  } catch (error) { if (!res.destroyed) next(error); }
});

router.put("/", async (req, res, next) => {
  if (!storage.enabled()) return res.status(503).json({ message: "Image storage is not configured." });
  try {
    if (!await images.lookup(req.user.id, req.params.id)) return res.status(404).json({ message: "Task not found." });
  } catch (error) { return next(error); }
  parseImage(req, res, (error) => {
    if (error?.status === 413) return res.status(413).json({ message: "This image exceeds 5 MB." });
    if (error?.status === 415) return res.status(415).json({ message: "Unsupported upload encoding." });
    if (error) return next(error);
    return next();
  });
}, async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: "Choose an image file." });
    let file, type;
    try {
      const input = sharp(req.body, { limitInputPixels: 16_000_000, failOn: "warning" });
      const { format } = await input.metadata();
      if (!Object.hasOwn(formats, format)) throw new Error("Unsupported image type");
      type = formats[format];
      // Decode and re-encode to reject corrupt input and remove embedded metadata.
      file = await input.rotate().toFormat(format).toBuffer();
    } catch {
      return res.status(415).json({ message: "Choose a readable JPEG, PNG, or WebP image up to 16 megapixels." });
    }
    if (file.length > maxBytes) return res.status(413).json({ message: "The processed image exceeds 5 MB." });
    const id = randomUUID();
    const name = typeof req.query.filename === "string" ? req.query.filename : "image";
    const image = {
      id, storage_key: `tasks/${req.user.id}/${req.params.id}/${id}`,
      filename: Array.from(name.replace(/[\x00-\x1f\x7f/\\]/g, "_")).slice(0, 200).join("") || "image",
      content_type: type, size_bytes: file.length,
    };
    if (!await images.change(req.user.id, req.params.id, image, file)) return res.status(404).json({ message: "Task not found." });
    void images.cleanDetached();
    return res.json({ image: metadata(image) });
  } catch (error) { next(error); }
});

router.delete("/", async (req, res, next) => {
  try {
    if (!storage.enabled()) return res.status(503).json({ message: "Image storage is not configured." });
    if (!await images.change(req.user.id, req.params.id)) return res.status(404).json({ message: "Task not found." });
    void images.cleanDetached();
    return res.sendStatus(204);
  } catch (error) { next(error); }
});

module.exports = router;
