import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import { ensureBucket, uploadObject, downloadObject } from "../services/aps-oss.js";
import {
  createWorkItem,
  waitForWorkItem,
  getWorkItemStatus,
} from "../services/aps-da.js";
import { computeBaysAndScript } from "../services/parking-engine.js";
import type { Job, GenerateRequest, ParkingRules } from "../types.js";

const router = Router();

// In-memory job store (production would use a database)
const jobs = new Map<string, Job>();

// File upload config — store in server/uploads/
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
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".dwg") {
      return cb(new Error("Only DWG files are accepted"));
    }
    cb(null, true);
  },
});

/**
 * POST /upload
 * Upload a DWG file. Stores it locally and uploads to APS OSS.
 * Returns a fileId for subsequent operations.
 */
router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
    const objectKey = `input-${fileId}.dwg`;

    // Upload to APS Object Storage
    await ensureBucket();
    await uploadObject(objectKey, req.file.path);

    console.log(`[Upload] File ${req.file.originalname} → OSS key: ${objectKey}`);

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

/**
 * POST /generate
 * Start the DWG processing pipeline:
 * 1. Generate parking bay geometry from rules
 * 2. Create an AutoCAD script with drawing commands
 * 3. Upload the script to APS OSS
 * 4. Submit a Design Automation work item
 * 5. Return a jobId for polling
 */
router.post("/generate", async (req, res, next) => {
  try {
    const { fileId, rules } = req.body as GenerateRequest;

    if (!fileId || !rules) {
      res.status(400).json({ error: "fileId and rules are required" });
      return;
    }

    const jobId = uuidv4();
    const inputObjectKey = `input-${fileId}.dwg`;
    const scriptObjectKey = `script-${jobId}.scr`;
    const outputObjectKey = `output-${jobId}.dwg`;

    // Create job record
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

    // Return immediately with jobId — processing happens asynchronously
    res.json({ jobId });

    // --- Async processing pipeline ---
    processJob(job, scriptObjectKey, rules).catch((err) => {
      console.error(`[Job ${jobId}] Failed:`, err.message);
      job.status = "failed";
      job.error = err.message;
      job.updatedAt = new Date();
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /download/:jobId
 * Check job status. If complete, returns the DWG file for download.
 * If still processing, returns status JSON.
 */
router.get("/download/:jobId", async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    // If the work item is still in progress, poll APS for latest status
    if (
      job.status === "processing" &&
      job.workItemId
    ) {
      try {
        const wiStatus = await getWorkItemStatus(job.workItemId);
        if (wiStatus.status === "success") {
          job.status = "complete";
          job.progress = 100;
          job.updatedAt = new Date();

          // Download the output DWG from OSS to local storage
          const outputPath = path.join(uploadsDir, `output-${jobId}.dwg`);
          await downloadObject(job.outputObjectKey, outputPath);
          job.outputFilePath = outputPath;
        } else if (
          wiStatus.status === "failedDownload" ||
          wiStatus.status === "failedInstructions" ||
          wiStatus.status === "failedUpload" ||
          wiStatus.status === "cancelled"
        ) {
          job.status = "failed";
          job.error = `AutoCAD processing failed: ${wiStatus.status}`;
          job.updatedAt = new Date();
        } else {
          job.progress = parseInt(wiStatus.progress, 10) || job.progress;
        }
      } catch {
        // Status check failed — return current known state
      }
    }

    // If complete, serve the file
    if (job.status === "complete" && job.outputFilePath) {
      if (!fs.existsSync(job.outputFilePath)) {
        res.status(500).json({ error: "Output file not found on server" });
        return;
      }

      const filename = `parking-output-${jobId.slice(0, 8)}.dwg`;
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
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

/**
 * Run the full processing pipeline for a job.
 */
async function processJob(
  job: Job,
  scriptObjectKey: string,
  rules: ParkingRules
): Promise<void> {
  // Step 1: Generate AutoCAD script from parking rules
  job.status = "uploading";
  job.progress = 10;
  job.updatedAt = new Date();

  // We need edge geometry from the DWG. For the Design Automation workflow,
  // the parking engine generates the script with bay placement commands.
  // Edge points are derived from a default road edge assumption or from
  // a prior analysis step. Here we generate the script with the rules.
  const { script } = computeBaysAndScript(
    // Default edge: straight line (the actual edge comes from the DWG,
    // processed by the AutoCAD script which reads existing geometry)
    generateDefaultEdge(),
    rules
  );

  // Step 2: Upload the script to OSS
  const scriptPath = path.join(uploadsDir, `script-${job.id}.scr`);
  fs.writeFileSync(scriptPath, script, "utf-8");
  await uploadObject(scriptObjectKey, scriptPath);
  fs.unlinkSync(scriptPath); // cleanup local script file

  job.progress = 30;
  job.updatedAt = new Date();

  // Step 3: Submit Design Automation work item
  job.status = "processing";
  const activityId = config.aps.activityId;

  if (!activityId) {
    throw new Error(
      "APS_ACTIVITY_ID not configured. Run `npm run setup-da` to create the Design Automation activity."
    );
  }

  const workItemId = await createWorkItem(
    job.sourceObjectKey,
    scriptObjectKey,
    job.outputObjectKey,
    activityId
  );

  job.workItemId = workItemId;
  job.progress = 40;
  job.updatedAt = new Date();

  console.log(`[Job ${job.id}] Work item submitted: ${workItemId}`);

  // Step 4: Wait for completion
  await waitForWorkItem(workItemId, (status) => {
    const pct = parseInt(status.progress, 10);
    if (!isNaN(pct)) {
      job.progress = 40 + Math.round(pct * 0.5); // 40-90% range
    }
    job.updatedAt = new Date();
  });

  // Step 5: Download result
  job.progress = 95;
  job.updatedAt = new Date();

  const outputPath = path.join(uploadsDir, `output-${job.id}.dwg`);
  await downloadObject(job.outputObjectKey, outputPath);
  job.outputFilePath = outputPath;

  job.status = "complete";
  job.progress = 100;
  job.updatedAt = new Date();

  console.log(`[Job ${job.id}] Complete — output: ${outputPath}`);
}

/**
 * Generate a default straight edge for script generation.
 * In a full implementation, this would be extracted from the uploaded DWG
 * via a preliminary Design Automation analysis step.
 */
function generateDefaultEdge() {
  const points = [];
  for (let i = 0; i <= 20; i++) {
    points.push({ x: i * 5, y: 0 });
  }
  return points;
}

export default router;
