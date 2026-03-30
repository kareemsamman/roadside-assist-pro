import axios from "axios";
import fs from "node:fs";
import { config } from "../config.js";
import { getAccessToken } from "./aps-auth.js";

const OSS_BASE = "https://developer.api.autodesk.com/oss/v2";

/**
 * Ensure the OSS bucket exists. Creates it if missing.
 */
export async function ensureBucket(): Promise<void> {
  const token = await getAccessToken();

  try {
    await axios.get(`${OSS_BASE}/buckets/${config.aps.bucketKey}/details`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err: any) {
    if (err.response?.status === 404) {
      await axios.post(
        `${OSS_BASE}/buckets`,
        {
          bucketKey: config.aps.bucketKey,
          policyKey: "transient", // auto-delete after 24h
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log(`[APS-OSS] Created bucket: ${config.aps.bucketKey}`);
    } else {
      throw err;
    }
  }
}

/**
 * Upload a file to the OSS bucket.
 * Returns the object URN needed for Design Automation.
 */
export async function uploadObject(
  objectKey: string,
  filePathOrBuffer: string | Buffer
): Promise<string> {
  const token = await getAccessToken();
  const fileBuffer =
    typeof filePathOrBuffer === "string"
      ? fs.readFileSync(filePathOrBuffer)
      : filePathOrBuffer;
  const fileSize = fileBuffer.length;

  const response = await axios.put(
    `${OSS_BASE}/buckets/${config.aps.bucketKey}/objects/${encodeURIComponent(objectKey)}`,
    fileBuffer,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Content-Length": fileSize.toString(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    }
  );

  return response.data.objectId; // urn:adsk.objects:os.object:bucket/key
}

/**
 * Generate a signed S3 URL for reading an object from OSS.
 */
export async function getSignedDownloadUrl(objectKey: string): Promise<string> {
  const token = await getAccessToken();

  const response = await axios.get(
    `${OSS_BASE}/buckets/${config.aps.bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3download`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { minutesExpiration: 60 },
    }
  );

  return response.data.url;
}

/**
 * Generate a signed S3 URL for uploading an object to OSS.
 */
export async function getSignedUploadUrl(objectKey: string): Promise<{
  url: string;
  uploadKey: string;
}> {
  const token = await getAccessToken();

  const response = await axios.get(
    `${OSS_BASE}/buckets/${config.aps.bucketKey}/objects/${encodeURIComponent(objectKey)}/signeds3upload`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { minutesExpiration: 60 },
    }
  );

  return {
    url: response.data.url,
    uploadKey: response.data.uploadKey,
  };
}

/**
 * Download an object from OSS to a local file path.
 */
export async function downloadObject(
  objectKey: string,
  destPath: string
): Promise<void> {
  const url = await getSignedDownloadUrl(objectKey);
  const response = await axios.get(url, { responseType: "arraybuffer" });
  fs.writeFileSync(destPath, Buffer.from(response.data));
}
