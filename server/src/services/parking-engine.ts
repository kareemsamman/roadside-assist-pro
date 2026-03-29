import type { ParkingRules, ParkingBay, Point2D } from "../types.js";

/**
 * Generate AutoCAD script (.scr) content that draws accessible parking bays
 * onto the input DWG file, then saves the result.
 *
 * The script uses standard AutoCAD commands:
 * - LAYER to create dedicated layers
 * - PLINE to draw bay outlines
 * - INSERT for pole/sign blocks
 * - TEXT for bay numbering
 * - SAVEAS to write the output DWG
 */
export function generateAutocadScript(rules: ParkingRules): string {
  const lines: string[] = [];

  // Header: set up drawing environment
  lines.push("CMDECHO 0");
  lines.push("OSMODE 0");
  lines.push(""); // blank line = Enter

  // Create layers for parking geometry
  lines.push("-LAYER");
  lines.push("N");
  lines.push("PARKING_BAYS");
  lines.push("C");
  lines.push("3"); // green
  lines.push("PARKING_BAYS");
  lines.push("");

  lines.push("-LAYER");
  lines.push("N");
  lines.push("PARKING_NUMBERS");
  lines.push("C");
  lines.push("7"); // white
  lines.push("PARKING_NUMBERS");
  lines.push("");

  if (rules.insertPole) {
    lines.push("-LAYER");
    lines.push("N");
    lines.push("PARKING_POLES");
    lines.push("C");
    lines.push("1"); // red
    lines.push("PARKING_POLES");
    lines.push("");
  }

  if (rules.insertSign) {
    lines.push("-LAYER");
    lines.push("N");
    lines.push("PARKING_SIGNS");
    lines.push("C");
    lines.push("5"); // blue
    lines.push("PARKING_SIGNS");
    lines.push("");
  }

  // The actual bay geometry is computed from the existing drawing's road
  // geometry at runtime via the Design Automation app bundle.
  // This script sets up layers and drawing parameters.
  // The parking bay coordinates are injected below by computeBayGeometry().

  // Set bay layer active
  lines.push("-LAYER");
  lines.push("S");
  lines.push("PARKING_BAYS");
  lines.push("");

  return lines.join("\n");
}

/**
 * Compute parking bay geometry along a polyline edge.
 * Returns bay positions and the complete AutoCAD script that draws them.
 *
 * @param edgePoints - The road edge polyline points from the uploaded DWG
 * @param rules - Parking configuration rules
 */
export function computeBaysAndScript(
  edgePoints: Point2D[],
  rules: ParkingRules
): { bays: ParkingBay[]; script: string } {
  const bays = computeBayGeometry(edgePoints, rules);
  const script = generateFullScript(rules, bays);
  return { bays, script };
}

/**
 * Compute parking bay positions along a road edge polyline.
 */
function computeBayGeometry(
  edgePoints: Point2D[],
  rules: ParkingRules
): ParkingBay[] {
  const bays: ParkingBay[] = [];

  // Calculate cumulative distances along the polyline
  const cumDist: number[] = [0];
  for (let i = 1; i < edgePoints.length; i++) {
    const dx = edgePoints[i].x - edgePoints[i - 1].x;
    const dy = edgePoints[i].y - edgePoints[i - 1].y;
    cumDist.push(cumDist[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLength = cumDist[cumDist.length - 1];

  // Place bays along the edge
  let station = rules.minClearance; // start after clearance zone
  let num = rules.startingNumber;
  const offsetDir = rules.side === "right" ? 1 : -1;

  while (station + rules.bayLength + rules.minClearance <= totalLength) {
    // Find the segment index for this station
    const { point, normal, angle } = interpolateEdge(
      edgePoints,
      cumDist,
      station + rules.bayLength / 2
    );

    const nx = normal.x * offsetDir;
    const ny = normal.y * offsetDir;

    // Center of the bay, offset from the edge
    const cx = point.x + nx * (rules.lateralOffset + rules.bayWidth / 2);
    const cy = point.y + ny * (rules.lateralOffset + rules.bayWidth / 2);

    let bayAngle = angle;
    let hw = rules.bayWidth / 2;
    let hl = rules.bayLength / 2;

    if (rules.orientation === "perpendicular") {
      bayAngle += Math.PI / 2;
      [hw, hl] = [hl, hw];
    } else if (rules.orientation === "angled") {
      const a = ((rules.orientationAngle || 60) * Math.PI) / 180;
      bayAngle += a;
    }

    const cos = Math.cos(bayAngle);
    const sin = Math.sin(bayAngle);

    const corners: [Point2D, Point2D, Point2D, Point2D] = [
      { x: cx + cos * hl - sin * hw, y: cy + sin * hl + cos * hw },
      { x: cx - cos * hl - sin * hw, y: cy - sin * hl + cos * hw },
      { x: cx - cos * hl + sin * hw, y: cy - sin * hl - cos * hw },
      { x: cx + cos * hl + sin * hw, y: cy + sin * hl - cos * hw },
    ];

    const bay: ParkingBay = {
      id: `bay-${num}`,
      number: `${rules.numberPrefix}${num}`,
      corners,
      center: { x: cx, y: cy },
      rotation: bayAngle * (180 / Math.PI),
      stationOffset: station,
    };

    if (rules.insertPole) {
      bay.polePosition = {
        x: cx + nx * (rules.bayWidth + 1),
        y: cy + ny * (rules.bayWidth + 1),
      };
    }

    if (rules.insertSign) {
      bay.signPosition = {
        x: cx + nx * (rules.bayWidth + 1.5),
        y: cy + ny * (rules.bayWidth + 1.5),
      };
    }

    bays.push(bay);
    station += rules.bayLength + rules.spacing;
    num++;
  }

  return bays;
}

/**
 * Interpolate a point, normal, and tangent angle at a given station along the edge.
 */
function interpolateEdge(
  points: Point2D[],
  cumDist: number[],
  station: number
): { point: Point2D; normal: Point2D; angle: number } {
  // Clamp station to valid range
  const totalLength = cumDist[cumDist.length - 1];
  station = Math.max(0, Math.min(station, totalLength));

  // Find segment
  let segIdx = 0;
  for (let i = 1; i < cumDist.length; i++) {
    if (cumDist[i] >= station) {
      segIdx = i - 1;
      break;
    }
  }

  const segLen = cumDist[segIdx + 1] - cumDist[segIdx];
  const t = segLen > 0 ? (station - cumDist[segIdx]) / segLen : 0;

  const p1 = points[segIdx];
  const p2 = points[segIdx + 1];

  const point: Point2D = {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Normal is perpendicular to tangent (rotated 90 degrees CCW)
  const normal: Point2D = len > 0 ? { x: -dy / len, y: dx / len } : { x: 0, y: 1 };
  const angle = Math.atan2(dy, dx);

  return { point, normal, angle };
}

/**
 * Generate the complete AutoCAD script with bay drawing commands.
 */
function generateFullScript(rules: ParkingRules, bays: ParkingBay[]): string {
  const lines: string[] = [];

  // Environment setup
  lines.push("CMDECHO 0");
  lines.push("OSMODE 0");
  lines.push("");

  // Create layers
  lines.push("-LAYER");
  lines.push("N");
  lines.push("PARKING_BAYS");
  lines.push("C");
  lines.push("3");
  lines.push("PARKING_BAYS");
  lines.push("");

  lines.push("-LAYER");
  lines.push("N");
  lines.push("PARKING_NUMBERS");
  lines.push("C");
  lines.push("7");
  lines.push("PARKING_NUMBERS");
  lines.push("");

  if (rules.insertPole) {
    lines.push("-LAYER N PARKING_POLES C 1 PARKING_POLES");
    lines.push("");
  }

  if (rules.insertSign) {
    lines.push("-LAYER N PARKING_SIGNS C 5 PARKING_SIGNS");
    lines.push("");
  }

  // Draw each bay
  for (const bay of bays) {
    // Set bay layer
    lines.push("-LAYER S PARKING_BAYS");
    lines.push("");

    // Draw bay outline as closed polyline
    const [c0, c1, c2, c3] = bay.corners;
    lines.push("PLINE");
    lines.push(`${fmt(c0.x)},${fmt(c0.y)}`);
    lines.push(`${fmt(c1.x)},${fmt(c1.y)}`);
    lines.push(`${fmt(c2.x)},${fmt(c2.y)}`);
    lines.push(`${fmt(c3.x)},${fmt(c3.y)}`);
    lines.push("C"); // close the polyline

    // Draw bay number as text
    lines.push("-LAYER S PARKING_NUMBERS");
    lines.push("");
    lines.push("-TEXT");
    lines.push(`${fmt(bay.center.x)},${fmt(bay.center.y)}`);
    lines.push(`${Math.max(0.3, rules.bayWidth * 0.25)}`); // text height
    lines.push(`${fmt(bay.rotation)}`); // text rotation
    lines.push(bay.number);

    // Draw pole marker (circle)
    if (rules.insertPole && bay.polePosition) {
      lines.push("-LAYER S PARKING_POLES");
      lines.push("");
      lines.push("CIRCLE");
      lines.push(`${fmt(bay.polePosition.x)},${fmt(bay.polePosition.y)}`);
      lines.push("0.15"); // radius
    }

    // Draw sign marker (rectangle)
    if (rules.insertSign && bay.signPosition) {
      lines.push("-LAYER S PARKING_SIGNS");
      lines.push("");
      const sx = bay.signPosition.x;
      const sy = bay.signPosition.y;
      lines.push("RECTANG");
      lines.push(`${fmt(sx - 0.2)},${fmt(sy - 0.3)}`);
      lines.push(`${fmt(sx + 0.2)},${fmt(sy + 0.3)}`);
    }
  }

  // Save the modified drawing as output.dwg
  lines.push("FILEDIA 0");
  lines.push('SAVEAS DWG "" "output.dwg"');
  lines.push("");

  return lines.join("\n");
}

function fmt(n: number): string {
  return n.toFixed(6);
}
