import type {
  UploadResponse,
  AnalyzeRoadResponse,
  GenerateParkingResponse,
  DetectClashesResponse,
  ExportRequest,
  ExportResponse,
  ParkingRules,
  ParkingBay,
} from "@/types/cad";
import {
  MOCK_UPLOAD,
  MOCK_ROAD_ANALYSIS,
  generateMockParkingBays,
  generateMockClashes,
} from "@/lib/mock-data";

// Set to empty string to use mock mode
let API_BASE_URL = "";

export function setApiBaseUrl(url: string) {
  API_BASE_URL = url.replace(/\/$/, "");
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function isUsingMockMode() {
  return !API_BASE_URL;
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadCADFile(file: File): Promise<UploadResponse> {
  if (isUsingMockMode()) {
    await delay(1500);
    return { ...MOCK_UPLOAD, filename: file.name, fileSize: file.size };
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
  return res.json();
}

export async function analyzeRoad(fileId: string): Promise<AnalyzeRoadResponse> {
  if (isUsingMockMode()) {
    await delay(1000);
    return MOCK_ROAD_ANALYSIS;
  }

  const res = await fetch(`${API_BASE_URL}/analyze-road`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  });
  if (!res.ok) throw new Error(`Road analysis failed: ${res.statusText}`);
  return res.json();
}

export async function generateParking(
  fileId: string,
  selectedEdgeId: string,
  rules: ParkingRules
): Promise<GenerateParkingResponse> {
  if (isUsingMockMode()) {
    await delay(800);
    return generateMockParkingBays(rules);
  }

  const res = await fetch(`${API_BASE_URL}/generate-parking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, selectedEdgeId, rules }),
  });
  if (!res.ok) throw new Error(`Parking generation failed: ${res.statusText}`);
  return res.json();
}

export async function detectClashes(
  fileId: string,
  bays: ParkingBay[]
): Promise<DetectClashesResponse> {
  if (isUsingMockMode()) {
    await delay(600);
    return generateMockClashes(bays);
  }

  const res = await fetch(`${API_BASE_URL}/detect-clashes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId, bays }),
  });
  if (!res.ok) throw new Error(`Clash detection failed: ${res.statusText}`);
  return res.json();
}

export async function exportDrawing(request: ExportRequest): Promise<ExportResponse> {
  if (isUsingMockMode()) {
    await delay(1200);
    return {
      downloadUrl: "#mock-download",
      format: "dwg",
      filename: "output_parking.dwg",
    };
  }

  const res = await fetch(`${API_BASE_URL}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
  return res.json();
}
