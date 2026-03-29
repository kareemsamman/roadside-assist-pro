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

/**
 * Create an Activity for AutoCAD Design Automation.
 * This only needs to run once during setup.
 */
export async function createActivity(
  activityId: string,
  description: string
): Promise<void> {
  const token = await getAccessToken();

  const nickname = await getNickname();

  const payload = {
    id: activityId,
    description,
    commandLine: [
      '$(engine.path)\\accoreconsole.exe /i "$(args[InputDwg].path)" /s "$(args[Script].path)"',
    ],
    engine: "Autodesk.AutoCAD+24.1",
    parameters: {
      InputDwg: {
        verb: "get",
        description: "Input DWG file",
        localName: "input.dwg",
      },
      Script: {
        verb: "get",
        description: "AutoCAD script file with drawing commands",
        localName: "commands.scr",
      },
      OutputDwg: {
        verb: "put",
        description: "Output DWG file",
        localName: "output.dwg",
      },
    },
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
      // Activity already exists, update it
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
 * Get the APS account nickname (used as activity owner prefix).
 */
export async function getNickname(): Promise<string> {
  const token = await getAccessToken();
  const response = await axios.get(`${DA_BASE}/forgeapps/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.nickname || response.data.id || config.aps.clientId;
}

/**
 * Submit a Design Automation work item.
 * Runs the AutoCAD engine with the input DWG and script, produces output DWG.
 */
export async function createWorkItem(
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
      InputDwg: {
        url: inputUrl,
        verb: "get",
      },
      Script: {
        url: scriptUrl,
        verb: "get",
      },
      OutputDwg: {
        url: outputUrl,
        verb: "put",
      },
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
 * Returns the final status.
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
        `Work item ${workItemId} failed with status: ${result.status}. Report: ${result.reportUrl || "N/A"}`
      );
    }

    // Poll every 3 seconds
    await new Promise((r) => setTimeout(r, 3000));
  }

  throw new Error(`Work item ${workItemId} timed out after ${timeoutMs}ms`);
}
