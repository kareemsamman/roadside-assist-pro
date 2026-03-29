import type {
  UploadResponse,
  AnalyzeRoadResponse,
  GenerateParkingResponse,
  DetectClashesResponse,
  ParkingRules,
  Point2D,
  ParkingBay,
} from "@/types/cad";

// Generate a straight road polyline parallel to centerline
function generateRoadPolyline(yOffset: number = 0): Point2D[] {
  const points: Point2D[] = [];
  const numPoints = 11;
  for (let i = 0; i <= numPoints; i++) {
    const x = (i / numPoints) * 100;
    const y = yOffset;
    points.push({ x, y });
  }
  return points;
}

export const MOCK_UPLOAD: UploadResponse = {
  fileId: "mock-file-001",
  filename: "highway_section_A1.dxf",
  fileSize: 2_450_000,
  format: "dxf",
  layers: [
    { name: "ROAD_CENTERLINE", color: 1, visible: true, entityCount: 1 },
    { name: "ROAD_EDGE_LEFT", color: 3, visible: true, entityCount: 1 },
    { name: "ROAD_EDGE_RIGHT", color: 3, visible: true, entityCount: 1 },
    { name: "ROAD_MARKINGS", color: 7, visible: true, entityCount: 12 },
    { name: "CURB", color: 8, visible: true, entityCount: 2 },
    { name: "BARRIERS", color: 5, visible: true, entityCount: 3 },
    { name: "TEXT_LABELS", color: 7, visible: true, entityCount: 8 },
    { name: "BLOCKS", color: 2, visible: true, entityCount: 5 },
  ],
  bounds: { min: { x: -5, y: -35 }, max: { x: 105, y: 35 } },
  polylines: [
    { id: "pl-center", points: generateRoadPolyline(0), layer: "ROAD_CENTERLINE", closed: false, color: 1 },
    { id: "pl-left", points: generateRoadPolyline(-3.5), layer: "ROAD_EDGE_LEFT", closed: false, color: 3 },
    { id: "pl-right", points: generateRoadPolyline(3.5), layer: "ROAD_EDGE_RIGHT", closed: false, color: 3 },
    { id: "pl-curb-l", points: generateRoadPolyline(-4.0), layer: "CURB", closed: false, color: 8 },
    { id: "pl-curb-r", points: generateRoadPolyline(4.0), layer: "CURB", closed: false, color: 8 },
    // A barrier polyline across part of the road
    {
      id: "pl-barrier",
      points: [
        { x: 55, y: 5 },
        { x: 60, y: 5 },
        { x: 65, y: 5 },
      ],
      layer: "BARRIERS",
      closed: false,
      color: 5,
    },
  ],
  blocks: [
    { id: "blk-1", name: "SIGN_POST", insertionPoint: { x: 20, y: -5 }, rotation: 0, scale: 1, layer: "BLOCKS", attributes: {} },
    { id: "blk-2", name: "LAMPPOST", insertionPoint: { x: 80, y: -5 }, rotation: 0, scale: 1, layer: "BLOCKS", attributes: {} },
  ],
  texts: [
    { id: "txt-1", content: "A1 Highway", position: { x: 50, y: -8 }, height: 2, rotation: 0, layer: "TEXT_LABELS" },
    { id: "txt-2", content: "KM 12+500", position: { x: 90, y: -8 }, height: 1.5, rotation: 0, layer: "TEXT_LABELS" },
  ],
};

export const MOCK_ROAD_ANALYSIS: AnalyzeRoadResponse = {
  centerline: MOCK_UPLOAD.polylines[0],
  edgeCandidates: [
    { id: "edge-left", polyline: MOCK_UPLOAD.polylines[1], confidence: 0.92, type: "left_edge", label: "Left road edge (ROAD_EDGE_LEFT)" },
    { id: "edge-right", polyline: MOCK_UPLOAD.polylines[2], confidence: 0.95, type: "right_edge", label: "Right road edge (ROAD_EDGE_RIGHT)" },
    { id: "edge-curb-l", polyline: MOCK_UPLOAD.polylines[3], confidence: 0.78, type: "curb", label: "Left curb line (CURB)" },
    { id: "edge-curb-r", polyline: MOCK_UPLOAD.polylines[4], confidence: 0.80, type: "curb", label: "Right curb line (CURB)" },
  ],
  direction: "forward",
  roadWidth: 7.0,
};

// Generate mock parking bays along the right edge
export function generateMockParkingBays(rules: ParkingRules): GenerateParkingResponse {
  const bays: ParkingBay[] = [];
  const edgePoints = MOCK_UPLOAD.polylines[2].points; // right edge
  const totalLength = 100; // straight road length 0→100

  let station = rules.spacing / 2;
  let num = rules.startingNumber;

  while (station + rules.bayLength < totalLength) {
    const t = station / totalLength;
    const idx = Math.min(Math.floor(t * (edgePoints.length - 1)), edgePoints.length - 2);
    const p1 = edgePoints[idx];
    const p2 = edgePoints[idx + 1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    const angle = Math.atan2(dy, dx);
    const offsetDir = rules.side === "right" ? 1 : -1;

    const cx = p1.x + (t * (edgePoints.length - 1) - idx) * dx + nx * offsetDir * (rules.lateralOffset + rules.bayWidth / 2);
    const cy = p1.y + (t * (edgePoints.length - 1) - idx) * dy + ny * offsetDir * (rules.lateralOffset + rules.bayWidth / 2);

    const hw = rules.bayWidth / 2;
    const hl = rules.bayLength / 2;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const corners: [Point2D, Point2D, Point2D, Point2D] = [
      { x: cx + cos * hl - sin * hw, y: cy + sin * hl + cos * hw },
      { x: cx - cos * hl - sin * hw, y: cy - sin * hl + cos * hw },
      { x: cx - cos * hl + sin * hw, y: cy - sin * hl - cos * hw },
      { x: cx + cos * hl + sin * hw, y: cy + sin * hl - cos * hw },
    ];

    bays.push({
      id: `bay-${num}`,
      number: `${rules.numberPrefix}${num}`,
      corners,
      center: { x: cx, y: cy },
      rotation: angle * (180 / Math.PI),
      polePosition: rules.insertPole ? { x: cx + nx * offsetDir * (rules.bayWidth + 1), y: cy + ny * offsetDir * (rules.bayWidth + 1) } : undefined,
      signPosition: rules.insertSign ? { x: cx + nx * offsetDir * (rules.bayWidth + 1.5), y: cy + ny * offsetDir * (rules.bayWidth + 1.5) } : undefined,
      stationOffset: station,
    });

    station += rules.spacing;
    num++;
  }

  return {
    bays,
    totalCount: bays.length,
    coveredLength: bays.length * rules.spacing,
    roadLength: totalLength,
  };
}

export function generateMockClashes(bays: ParkingBay[]): DetectClashesResponse {
  const clashes: DetectClashesResponse["clashes"] = [];

  // Simulate a clash with the barrier for bays near station 130-160
  bays.forEach((bay) => {
    if (bay.stationOffset > 120 && bay.stationOffset < 160) {
      clashes.push({
        id: `clash-${bay.id}`,
        bayId: bay.id,
        bayNumber: bay.number,
        type: "overlap_entity",
        severity: "error",
        description: `Bay ${bay.number} overlaps with barrier on layer BARRIERS`,
        conflictEntityId: "pl-barrier",
        conflictEntityLayer: "BARRIERS",
        position: bay.center,
      });
    }
    // Curve warning for bays near the peak of the curve
    if (bay.stationOffset > 140 && bay.stationOffset < 180) {
      clashes.push({
        id: `warn-${bay.id}`,
        bayId: bay.id,
        bayNumber: bay.number,
        type: "curve_warning",
        severity: "warning",
        description: `Bay ${bay.number} is on a curve segment — verify clearance`,
        position: bay.center,
      });
    }
  });

  const invalidCount = clashes.filter((c) => c.severity === "error").length;
  const warningCount = clashes.filter((c) => c.severity === "warning").length;

  return {
    clashes,
    validBayCount: bays.length - invalidCount,
    invalidBayCount: invalidCount,
    warningBayCount: warningCount,
  };
}
