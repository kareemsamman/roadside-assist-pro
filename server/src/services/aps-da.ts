import axios from "axios";
import { config } from "../config.js";
import { getAccessToken } from "./aps-auth.js";
import { getSignedDownloadUrl, getSignedUploadUrl } from "./aps-oss.js";

const DA_BASE = "https://developer.api.autodesk.com/da/us-east/v3";

export type WorkItemStatus =
  | "pending"
  | "inprogress"
  | "success"
  | "failedDownload"
  | "failedInstructions"
  | "failedUpload"
  | "cancelled";

interface WorkItemResult {
  id: string;
  status: WorkItemStatus;
  progress: string;
  reportUrl?: string;
}

// ==================== Activity Management ====================

interface ActivityParams {
  [key: string]: {
    verb: "get" | "put";
    description: string;
    localName: string;
  };
}

/**
 * Register a Design Automation activity.
 * Handles 409 (already exists) by updating.
 */
async function registerActivity(
  activityId: string,
  description: string,
  commandLine: string,
  parameters: ActivityParams
): Promise<void> {
  const token = await getAccessToken();
  const nickname = await getNickname();

  const payload = {
    id: activityId,
    description,
    commandLine: [commandLine],
    engine: "Autodesk.AutoCAD+24.1",
    parameters,
  };

  try {
    await axios.post(`${DA_BASE}/activities`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    if (err.response?.status === 409) {
      await axios.patch(
        `${DA_BASE}/activities/${nickname}.${activityId}+prod`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      throw err;
    }
  }

  // Create or update alias "prod"
  try {
    await axios.post(
      `${DA_BASE}/activities/${activityId}/aliases`,
      { id: "prod", version: 1 },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    if (err.response?.status === 409) {
      await axios.patch(
        `${DA_BASE}/activities/${activityId}/aliases/prod`,
        { version: 1 },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      throw err;
    }
  }
}

/**
 * Create the geometry extraction activity.
 * Runs an AutoLISP script that reads all polylines from the DWG
 * and writes their coordinates to a JSON file.
 */
export async function createExtractActivity(
  activityId: string,
  description: string
): Promise<void> {
  await registerActivity(
    activityId,
    description,
    '$(engine.path)\\accoreconsole.exe /i "$(args[InputDwg].path)" /s "$(args[Script].path)"',
    {
      InputDwg: {
        verb: "get",
        description: "Input DWG file to extract geometry from",
        localName: "input.dwg",
      },
      Script: {
        verb: "get",
        description: "AutoLISP extraction script (.scr)",
        localName: "extract.scr",
      },
      OutputJson: {
        verb: "put",
        description: "Extracted polyline geometry as JSON",
        localName: "extracted.json",
      },
    }
  );
}

/**
 * Create the parking bay generation activity.
 * Runs an AutoCAD script that draws parking bays onto the DWG.
 */
export async function createGenerateActivity(
  activityId: string,
  description: string
): Promise<void> {
  await registerActivity(
    activityId,
    description,
    '$(engine.path)\\accoreconsole.exe /i "$(args[InputDwg].path)" /s "$(args[Script].path)"',
    {
      InputDwg: {
        verb: "get",
        description: "Input DWG file",
        localName: "input.dwg",
      },
      Script: {
        verb: "get",
        description: "AutoCAD script with parking bay drawing commands",
        localName: "commands.scr",
      },
      OutputDwg: {
        verb: "put",
        description: "Output DWG file with parking bays",
        localName: "output.dwg",
      },
    }
  );
}

// ==================== Nickname ====================

/**
 * Get the APS account nickname (used as activity owner prefix).
 */
export async function getNickname(): Promise<string> {
  const token = await getAccessToken();
  const response = await axios.get(`${DA_BASE}/forgeapps/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.nickname || response.data.id || config.aps.clientId;
}

// ==================== Work Items ====================

/**
 * Submit an extraction work item.
 * Runs the LISP extraction script on the DWG and produces a JSON output.
 */
export async function createExtractWorkItem(
  inputObjectKey: string,
  scriptObjectKey: string,
  outputJsonObjectKey: string,
  activityId: string
): Promise<string> {
  const token = await getAccessToken();

  const inputUrl = await getSignedDownloadUrl(inputObjectKey);
  const scriptUrl = await getSignedDownloadUrl(scriptObjectKey);
  const { url: outputUrl } = await getSignedUploadUrl(outputJsonObjectKey);

  const payload = {
    activityId,
    arguments: {
      InputDwg: { url: inputUrl, verb: "get" },
      Script: { url: scriptUrl, verb: "get" },
      OutputJson: { url: outputUrl, verb: "put" },
    },
  };

  const response = await axios.post(`${DA_BASE}/workitems`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return response.data.id;
}

/**
 * Submit a generation work item.
 * Runs the parking drawing script on the DWG and produces the output DWG.
 */
export async function createGenerateWorkItem(
  inputObjectKey: string,
  scriptObjectKey: string,
  outputObjectKey: string,
  activityId: string
): Promise<string> {
  const token = await getAccessToken();

  const inputUrl = await getSignedDownloadUrl(inputObjectKey);
  const scriptUrl = await getSignedDownloadUrl(scriptObjectKey);
  const { url: outputUrl } = await getSignedUploadUrl(outputObjectKey);

  const payload = {
    activityId,
    arguments: {
      InputDwg: { url: inputUrl, verb: "get" },
      Script: { url: scriptUrl, verb: "get" },
      OutputDwg: { url: outputUrl, verb: "put" },
    },
  };

  const response = await axios.post(`${DA_BASE}/workitems`, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return response.data.id;
}

/**
 * Check the status of a Design Automation work item.
 */
export async function getWorkItemStatus(
  workItemId: string
): Promise<WorkItemResult> {
  const token = await getAccessToken();

  const response = await axios.get(`${DA_BASE}/workitems/${workItemId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    id: response.data.id,
    status: response.data.status,
    progress: response.data.progress || "0",
    reportUrl: response.data.reportUrl,
  };
}

/**
 * Poll a work item until it completes or fails.
 */
export async function waitForWorkItem(
  workItemId: string,
  onProgress?: (status: WorkItemResult) => void,
  timeoutMs: number = 300_000
): Promise<WorkItemResult> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const result = await getWorkItemStatus(workItemId);

    if (onProgress) onProgress(result);

    if (result.status === "success") return result;
    if (
      result.status === "failedDownload" ||
      result.status === "failedInstructions" ||
      result.status === "failedUpload" ||
      result.status === "cancelled"
    ) {
      throw new Error(
        `Work item ${workItemId} failed: ${result.status}. Report: ${result.reportUrl || "N/A"}`
      );
    }

    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`Work item ${workItemId} timed out after ${timeoutMs}ms`);
}
