// ==================== CAD Geometry Types ====================

export interface Point2D {
  x: number;
  y: number;
}

export interface Polyline {
  id: string;
  points: Point2D[];
  layer: string;
  closed: boolean;
  color?: number;
}

export interface CADBlock {
  id: string;
  name: string;
  insertionPoint: Point2D;
  rotation: number;
  scale: number;
  layer: string;
  attributes: Record<string, string>;
}

export interface CADText {
  id: string;
  content: string;
  position: Point2D;
  height: number;
  rotation: number;
  layer: string;
}

export interface CADLayer {
  name: string;
  color: number;
  visible: boolean;
  entityCount: number;
}

// ==================== API Request/Response Types ====================

export interface UploadResponse {
  fileId: string;
  filename: string;
  fileSize: number;
  format: "dwg" | "dxf";
  layers: CADLayer[];
  bounds: { min: Point2D; max: Point2D };
  polylines: Polyline[];
  blocks: CADBlock[];
  texts: CADText[];
}

export interface RoadEdgeCandidate {
  id: string;
  polyline: Polyline;
  confidence: number;
  type: "centerline" | "left_edge" | "right_edge" | "curb" | "shoulder" | "boundary";
  label: string;
}

export interface AnalyzeRoadResponse {
  centerline: Polyline | null;
  edgeCandidates: RoadEdgeCandidate[];
  direction: "forward" | "reverse";
  roadWidth: number | null;
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

export interface GenerateParkingResponse {
  bays: ParkingBay[];
  totalCount: number;
  coveredLength: number;
  roadLength: number;
}

export interface ClashResult {
  id: string;
  bayId: string;
  bayNumber: string;
  type: "overlap_entity" | "overlap_bay" | "curve_warning" | "restricted_area";
  severity: "error" | "warning";
  description: string;
  conflictEntityId?: string;
  conflictEntityLayer?: string;
  position: Point2D;
}

export interface DetectClashesResponse {
  clashes: ClashResult[];
  validBayCount: number;
  invalidBayCount: number;
  warningBayCount: number;
}

export interface ExportRequest {
  fileId: string;
  bays: ParkingBay[];
  approvedBayIds: string[];
  rules: ParkingRules;
  selectedEdgeId: string;
}

export interface ExportResponse {
  downloadUrl: string;
  format: "dwg" | "dxf";
  filename: string;
}

// ==================== Workflow State ====================

export type WorkflowStep = "upload" | "analyze" | "configure" | "preview" | "export";

export interface WorkflowState {
  currentStep: WorkflowStep;
  uploadData: UploadResponse | null;
  roadAnalysis: AnalyzeRoadResponse | null;
  selectedEdgeId: string | null;
  parkingSide: "left" | "right";
  parkingRules: ParkingRules;
  generatedBays: ParkingBay[];
  clashResults: ClashResult[];
  approvedBayIds: Set<string>;
  isLoading: boolean;
  error: string | null;
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
