export interface Point2D {
  x: number;
  y: number;
}

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

export interface ParkingBay {
  id: string;
  number: string;
  corners: [Point2D, Point2D, Point2D, Point2D];
  center: Point2D;
  rotation: number;
  polePosition?: Point2D;
  signPosition?: Point2D;
  stationOffset: number;
}

export type JobStatus = "pending" | "uploading" | "processing" | "complete" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  progress: number;
  sourceObjectKey: string;
  outputObjectKey: string;
  outputFilePath?: string;
  workItemId?: string;
  error?: string;
  rules?: ParkingRules;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadResult {
  fileId: string;
  filename: string;
  fileSize: number;
  objectKey: string;
}

export interface GenerateRequest {
  fileId: string;
  rules: ParkingRules;
}

export interface GenerateResult {
  jobId: string;
}

export interface DownloadStatus {
  status: JobStatus;
  progress: number;
  error?: string;
  ready: boolean;
}
