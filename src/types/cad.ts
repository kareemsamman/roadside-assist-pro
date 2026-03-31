// ==================== Parking Rules ====================

export interface ParkingRules {
  bayWidth: number;
  bayLength: number;
  spacing: number;
  lateralOffset: number;
  orientation: "parallel" | "perpendicular" | "angled";
  orientationAngle?: number;
  minClearance: number;
  side: "left" | "right";
  startingNumber: number;
  numberPrefix: string;
  insertPole: boolean;
  insertSign: boolean;
}

export const DEFAULT_PARKING_RULES: ParkingRules = {
  bayWidth: 2.5,
  bayLength: 7.5,
  spacing: 20,
  lateralOffset: 0.5,
  orientation: "parallel",
  minClearance: 1.0,
  side: "right",
  startingNumber: 1,
  numberPrefix: "P",
  insertPole: true,
  insertSign: true,
};

// ==================== API Request/Response Types ====================

export interface UploadResponse {
  fileId: string;
  filename: string;
  fileSize: number;
  objectKey: string;
  urn?: string;
}

export interface GenerateRequest {
  fileId: string;
  rules: ParkingRules;
}

export interface GenerateResponse {
  jobId: string;
}

export type JobStatus = "pending" | "uploading" | "extracting" | "computing" | "processing" | "complete" | "failed";

export interface DownloadStatus {
  status: JobStatus;
  progress: number;
  error?: string;
  ready: boolean;
  outputUrn?: string;
}

// ==================== Workflow State ====================

export type WorkflowStep = "upload" | "configure" | "export";

export interface WorkflowState {
  currentStep: WorkflowStep;
  fileId: string | null;
  filename: string | null;
  fileSize: number | null;
  viewerUrn: string | null;
  outputUrn: string | null;
  parkingRules: ParkingRules;
  jobId: string | null;
  jobStatus: JobStatus | null;
  jobProgress: number;
  jobError: string | null;
  isLoading: boolean;
  error: string | null;
}
