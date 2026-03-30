import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import {
  ensureBucket,
  uploadObject,
  downloadObject,
} from "../services/aps-oss.js";
import {
  createExtractWorkItem,
  createGenerateWorkItem,
  waitForWorkItem,
  getWorkItemStatus,
} from "../services/aps-da.js";
import {
  generateExtractionScript,
  parseExtractedGeometry,
  selectRoadEdge,
} from "../services/geometry-extractor.js";
import { computeBaysAndScript } from "../services/parking-engine.js";
import type { Job, GenerateRequest, ParkingRules } from "../types.js";

const router = Router();

// In-memory job store (production would use a database)
const jobs = new Map<string, Job>();

// File upload config
const uploadsDir = path.resolve(process.cwd(), "uploads");
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".dwg") {
      return cb(new Error("Only DWG files are accepted"));
    }
    cb(null, true);
  },
});

// ─────────────────────────────────────────────────────────────
// POST /upload
// ─────────────────────────────────────────────────────────────

router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    if (!req.file.path && !req.file.buffer) {
      res.status(500).json({
        error: "File was not saved to disk. Check server write permissions and uploads directory.",
      });
      return;
    }

    const fileId = path.basename(
      req.file.filename,
      path.extname(req.file.filename)
    );
    const objectKey = `input-${fileId}.dwg`;

    await ensureBucket();
    await uploadObject(objectKey, req.file.path);

    console.log(
      `[Upload] ${req.file.originalname} → OSS key: ${objectKey}`
    );

    res.json({
      fileId,
      filename: req.file.originalname,
      fileSize: req.file.size,
      objectKey,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /generate
// ─────────────────────────────────────────────────────────────

router.post("/generate", async (req, res, next) => {
  try {
    const { fileId, rules } = req.body as GenerateRequest;

    if (!fileId || !rules) {
      res.status(400).json({ error: "fileId and rules are required" });
      return;
    }

    if (!config.aps.extractActivityId) {
      res.status(500).json({
        error:
          "APS_EXTRACT_ACTIVITY_ID not configured. Run: npm run setup-da",
      });
      return;
    }
    if (!config.aps.generateActivityId) {
      res.status(500).json({
        error:
          "APS_GENERATE_ACTIVITY_ID not configured. Run: npm run setup-da",
      });
      return;
    }

    const jobId = uuidv4();
    const inputObjectKey = `input-${fileId}.dwg`;
    const outputObjectKey = `output-${jobId}.dwg`;

    const job: Job = {
      id: jobId,
      status: "pending",
      progress: 0,
      sourceObjectKey: inputObjectKey,
      outputObjectKey,
      rules,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jobs.set(jobId, job);

    // Return immediately — processing is async
    res.json({ jobId });

    // Launch the 2-phase pipeline
    processJob(job, rules).catch((err) => {
      console.error(`[Job ${jobId}] Failed:`, err.message);
      job.status = "failed";
      job.error = err.message;
      job.updatedAt = new Date();
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /download/:jobId
// ─────────────────────────────────────────────────────────────

router.get("/download/:jobId", async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    // Live-update from the generate work item if still processing
    if (job.status === "processing" && job.generateWorkItemId) {
      try {
        const wiStatus = await getWorkItemStatus(job.generateWorkItemId);
        if (wiStatus.status === "success") {
          job.status = "complete";
          job.progress = 100;
          job.updatedAt = new Date();

          const outputPath = path.join(uploadsDir, `output-${jobId}.dwg`);
          await downloadObject(job.outputObjectKey, outputPath);
          job.outputFilePath = outputPath;
        } else if (isFailedStatus(wiStatus.status)) {
          job.status = "failed";
          job.error = `AutoCAD processing failed: ${wiStatus.status}`;
          job.updatedAt = new Date();
        } else {
          job.progress =
            60 + Math.round((parseInt(wiStatus.progress, 10) || 0) * 0.35);
        }
      } catch {
        // Poll failed — return current known state
      }
    }

    // Serve file if complete
    if (job.status === "complete" && job.outputFilePath) {
      if (!fs.existsSync(job.outputFilePath)) {
        res.status(500).json({ error: "Output file not found on server" });
        return;
      }

      const filename = `parking-output-${jobId.slice(0, 8)}.dwg`;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Type", "application/octet-stream");
      res.sendFile(job.outputFilePath);
      return;
    }

    // Otherwise return status
    res.json({
      status: job.status,
      progress: job.progress,
      error: job.error || undefined,
      ready: job.status === "complete",
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
// Two-phase processing pipeline
// ─────────────────────────────────────────────────────────────

async function processJob(job: Job, rules: ParkingRules): Promise<void> {
  // ── Phase 1: Extract real geometry from the DWG ──────────

  job.status = "extracting";
  job.progress = 5;
  job.updatedAt = new Date();

  console.log(`[Job ${job.id}] Phase 1: Extracting geometry from DWG...`);

  // Generate the LISP extraction script
  const extractScriptContent = generateExtractionScript();
  const extractScriptKey = `extract-script-${job.id}.scr`;
  const extractScriptPath = path.join(uploadsDir, extractScriptKey);
  fs.writeFileSync(extractScriptPath, extractScriptContent, "utf-8");

  // Upload extraction script to OSS
  await uploadObject(extractScriptKey, extractScriptPath);
  fs.unlinkSync(extractScriptPath);

  job.progress = 10;
  job.updatedAt = new Date();

  // Submit extraction work item
  const extractOutputKey = `extracted-${job.id}.json`;
  const extractWorkItemId = await createExtractWorkItem(
    job.sourceObjectKey,
    extractScriptKey,
    extractOutputKey,
    config.aps.extractActivityId
  );

  job.extractWorkItemId = extractWorkItemId;
  job.progress = 15;
  job.updatedAt = new Date();

  console.log(
    `[Job ${job.id}] Extract work item submitted: ${extractWorkItemId}`
  );

  // Wait for extraction to complete
  await waitForWorkItem(extractWorkItemId, (status) => {
    const pct = parseInt(status.progress, 10);
    if (!isNaN(pct)) {
      job.progress = 15 + Math.round(pct * 0.25); // 15–40%
    }
    job.updatedAt = new Date();
  });

  // Download the extracted JSON
  const extractedJsonPath = path.join(uploadsDir, `extracted-${job.id}.json`);
  await downloadObject(extractOutputKey, extractedJsonPath);

  const jsonContent = fs.readFileSync(extractedJsonPath, "utf-8");
  fs.unlinkSync(extractedJsonPath);

  job.progress = 45;
  job.updatedAt = new Date();

  console.log(`[Job ${job.id}] Extraction complete. Parsing geometry...`);

  // ── Phase 2: Compute bays from real geometry + draw ──────

  job.status = "computing";
  job.progress = 48;
  job.updatedAt = new Date();

  // Parse extracted geometry and select the road edge
  const geometry = parseExtractedGeometry(jsonContent);
  const { polyline: selectedEdge, edgePoints } = selectRoadEdge(geometry);

  console.log(
    `[Job ${job.id}] Selected edge: layer="${selectedEdge.layer}" ` +
    `with ${edgePoints.length} points`
  );

  // Compute parking bays using the REAL edge geometry
  const { bays, script: drawScript } = computeBaysAndScript(
    edgePoints,
    rules
  );

  console.log(
    `[Job ${job.id}] Computed ${bays.length} parking bays. ` +
    `Submitting drawing work item...`
  );

  job.progress = 55;
  job.updatedAt = new Date();

  // Upload the drawing script to OSS
  const drawScriptKey = `draw-script-${job.id}.scr`;
  const drawScriptPath = path.join(uploadsDir, drawScriptKey);
  fs.writeFileSync(drawScriptPath, drawScript, "utf-8");
  await uploadObject(drawScriptKey, drawScriptPath);
  fs.unlinkSync(drawScriptPath);

  // Submit the generate work item
  job.status = "processing";
  job.progress = 60;
  job.updatedAt = new Date();

  const generateWorkItemId = await createGenerateWorkItem(
    job.sourceObjectKey,
    drawScriptKey,
    job.outputObjectKey,
    config.aps.generateActivityId
  );

  job.generateWorkItemId = generateWorkItemId;
  job.progress = 65;
  job.updatedAt = new Date();

  console.log(
    `[Job ${job.id}] Generate work item submitted: ${generateWorkItemId}`
  );

  // Wait for the drawing to complete
  await waitForWorkItem(generateWorkItemId, (status) => {
    const pct = parseInt(status.progress, 10);
    if (!isNaN(pct)) {
      job.progress = 65 + Math.round(pct * 0.3); // 65–95%
    }
    job.updatedAt = new Date();
  });

  // Download the final output DWG
  job.progress = 96;
  job.updatedAt = new Date();

  const outputPath = path.join(uploadsDir, `output-${job.id}.dwg`);
  await downloadObject(job.outputObjectKey, outputPath);
  job.outputFilePath = outputPath;

  job.status = "complete";
  job.progress = 100;
  job.updatedAt = new Date();

  console.log(`[Job ${job.id}] Complete — ${bays.length} bays → ${outputPath}`);
}

function isFailedStatus(status: string): boolean {
  return (
    status === "failedDownload" ||
    status === "failedInstructions" ||
    status === "failedUpload" ||
    status === "cancelled"
  );
}

export default router;
