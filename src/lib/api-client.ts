import type {
  UploadResponse,
  GenerateResponse,
  DownloadStatus,
  ParkingRules,
} from "@/types/cad";

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "https://api.kareemsamman.com";

console.log("[api-client] Using API_BASE_URL:", API_BASE_URL);

export async function uploadDWGFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Upload failed (${API_BASE_URL}/upload): ${res.statusText}`);
  }

  return res.json();
}

export async function generateParking(
  fileId: string,
  rules: ParkingRules
): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, rules }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Generate failed: ${res.statusText}`);
  }

  return res.json();
}

export async function getDownloadStatus(jobId: string): Promise<DownloadStatus | "file"> {
  const res = await fetch(`${API_BASE_URL}/download/${jobId}`);

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Status check failed: ${res.statusText}`);
  }

  // If the response is a file download (octet-stream), return "file"
  const contentType = res.headers.get("Content-Type") || "";
  if (contentType.includes("octet-stream")) {
    // Trigger browser download
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch?.[1] || `parking-output-${jobId.slice(0, 8)}.dwg`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return "file";
  }

  const data = await res.json();

  // Normalize backend response: handle "completed" → "complete", missing fields
  return {
    status: data.status === "completed" ? "complete" : (data.status ?? "processing"),
    progress: data.progress ?? 0,
    error: data.error,
    ready: data.ready ?? data.status === "completed" ?? false,
  } as DownloadStatus;
}

export function getDownloadUrl(jobId: string): string {
  return `${API_BASE_URL}/download/${jobId}`;
}
