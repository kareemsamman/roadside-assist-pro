import type { ParkingRules, ParkingBay, Point2D } from "../types.js";

/**
 * Compute parking bay geometry along a polyline edge extracted from the real DWG,
 * then generate the complete AutoCAD script that draws them back into the drawing.
 *
 * @param edgePoints - Real road edge polyline points extracted from the uploaded DWG
 * @param rules - Parking configuration rules from the user
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
 * Bay placement is deterministic: given the same edge + rules, produces identical output.
 */
function computeBayGeometry(
  edgePoints: Point2D[],
  rules: ParkingRules
): ParkingBay[] {
  if (edgePoints.length < 2) {
    throw new Error(
      "Road edge must have at least 2 points. " +
      "The extracted polyline has insufficient geometry."
    );
  }

  const bays: ParkingBay[] = [];

  // Calculate cumulative distances along the polyline
  const cumDist: number[] = [0];
  for (let i = 1; i < edgePoints.length; i++) {
    const dx = edgePoints[i].x - edgePoints[i - 1].x;
    const dy = edgePoints[i].y - edgePoints[i - 1].y;
    cumDist.push(cumDist[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  const totalLength = cumDist[cumDist.length - 1];

  if (totalLength < rules.bayLength + 2 * rules.minClearance) {
    throw new Error(
      `Road edge is too short (${totalLength.toFixed(1)}m) for even one bay ` +
      `(need ${(rules.bayLength + 2 * rules.minClearance).toFixed(1)}m minimum).`
    );
  }

  // Place bays along the edge
  let station = rules.minClearance;
  let num = rules.startingNumber;
  const offsetDir = rules.side === "right" ? 1 : -1;

  while (station + rules.bayLength + rules.minClearance <= totalLength) {
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
  const totalLength = cumDist[cumDist.length - 1];
  station = Math.max(0, Math.min(station, totalLength));

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

  const normal: Point2D =
    len > 0 ? { x: -dy / len, y: dx / len } : { x: 0, y: 1 };
  const angle = Math.atan2(dy, dx);

  return { point, normal, angle };
}

/**
 * Generate the complete AutoCAD script with:
 * - Block definitions via LISP entmake (PARKING_POLE, PARKING_SIGN)
 * - Layer creation
 * - Bay outlines as closed polylines
 * - Bay numbers as text
 * - Pole/sign placement as real block INSERTs
 * - SAVEAS for output DWG
 */
function generateFullScript(rules: ParkingRules, bays: ParkingBay[]): string {
  const lines: string[] = [];

  // ── Environment setup ──
  lines.push("CMDECHO 0");
  lines.push("OSMODE 0");
  lines.push("");

  // ── Define blocks via LISP entmake ──
  if (rules.insertPole) {
    lines.push(POLE_BLOCK_LISP);
  }
  if (rules.insertSign) {
    lines.push(SIGN_BLOCK_LISP);
  }

  // ── Create layers ──
  lines.push("-LAYER N PARKING_BAYS C 3 PARKING_BAYS");
  lines.push("");
  lines.push("-LAYER N PARKING_NUMBERS C 7 PARKING_NUMBERS");
  lines.push("");

  if (rules.insertPole) {
    lines.push("-LAYER N PARKING_POLES C 1 PARKING_POLES");
    lines.push("");
  }

  if (rules.insertSign) {
    lines.push("-LAYER N PARKING_SIGNS C 5 PARKING_SIGNS");
    lines.push("");
  }

  // ── Draw each bay ──
  for (const bay of bays) {
    // Bay outline — closed polyline
    lines.push("-LAYER S PARKING_BAYS");
    lines.push("");
    const [c0, c1, c2, c3] = bay.corners;
    lines.push("PLINE");
    lines.push(`${fmt(c0.x)},${fmt(c0.y)}`);
    lines.push(`${fmt(c1.x)},${fmt(c1.y)}`);
    lines.push(`${fmt(c2.x)},${fmt(c2.y)}`);
    lines.push(`${fmt(c3.x)},${fmt(c3.y)}`);
    lines.push("C");

    // Bay number — text at center
    lines.push("-LAYER S PARKING_NUMBERS");
    lines.push("");
    lines.push("-TEXT");
    lines.push(`${fmt(bay.center.x)},${fmt(bay.center.y)}`);
    lines.push(`${Math.max(0.3, rules.bayWidth * 0.25)}`);
    lines.push(`${fmt(bay.rotation)}`);
    lines.push(bay.number);

    // Pole — block INSERT
    if (rules.insertPole && bay.polePosition) {
      lines.push("-LAYER S PARKING_POLES");
      lines.push("");
      lines.push("-INSERT");
      lines.push("PARKING_POLE");
      lines.push(`${fmt(bay.polePosition.x)},${fmt(bay.polePosition.y)}`);
      lines.push("1"); // X scale
      lines.push("1"); // Y scale
      lines.push(`${fmt(bay.rotation)}`);
    }

    // Sign — block INSERT
    if (rules.insertSign && bay.signPosition) {
      lines.push("-LAYER S PARKING_SIGNS");
      lines.push("");
      lines.push("-INSERT");
      lines.push("PARKING_SIGN");
      lines.push(`${fmt(bay.signPosition.x)},${fmt(bay.signPosition.y)}`);
      lines.push("1");
      lines.push("1");
      lines.push(`${fmt(bay.rotation)}`);
    }
  }

  // ── Save output ──
  lines.push("FILEDIA 0");
  lines.push('SAVEAS DWG "" "output.dwg"');
  lines.push("");

  return lines.join("\n");
}

function fmt(n: number): string {
  return n.toFixed(6);
}

// ── Block definitions as inline LISP ──
// These use entmake to create proper AutoCAD block definitions.
// entmake avoids the interactive BLOCK command and works in accoreconsole.

/**
 * PARKING_POLE block: circle (r=0.15) with crosshair lines.
 * Represents a physical pole position in the drawing.
 */
const POLE_BLOCK_LISP = `(if (not (tblsearch "BLOCK" "PARKING_POLE"))
  (progn
    (entmake (list
      '(0 . "BLOCK")
      '(2 . "PARKING_POLE")
      (cons 10 (list 0.0 0.0 0.0))
      '(70 . 0)))
    (entmake (list
      '(0 . "CIRCLE")
      (cons 10 (list 0.0 0.0 0.0))
      '(40 . 0.15)))
    (entmake (list
      '(0 . "LINE")
      (cons 10 (list -0.25 0.0 0.0))
      (cons 11 (list 0.25 0.0 0.0))))
    (entmake (list
      '(0 . "LINE")
      (cons 10 (list 0.0 -0.25 0.0))
      (cons 11 (list 0.0 0.25 0.0))))
    (entmake '((0 . "ENDBLK") (2 . "PARKING_POLE")))
  )
)`;

/**
 * PARKING_SIGN block: rectangle outline with "P" text.
 * Represents a parking sign position in the drawing.
 */
const SIGN_BLOCK_LISP = `(if (not (tblsearch "BLOCK" "PARKING_SIGN"))
  (progn
    (entmake (list
      '(0 . "BLOCK")
      '(2 . "PARKING_SIGN")
      (cons 10 (list 0.0 0.0 0.0))
      '(70 . 0)))
    (entmake (list
      '(0 . "LINE")
      (cons 10 (list -0.3 -0.4 0.0))
      (cons 11 (list 0.3 -0.4 0.0))))
    (entmake (list
      '(0 . "LINE")
      (cons 10 (list 0.3 -0.4 0.0))
      (cons 11 (list 0.3 0.4 0.0))))
    (entmake (list
      '(0 . "LINE")
      (cons 10 (list 0.3 0.4 0.0))
      (cons 11 (list -0.3 0.4 0.0))))
    (entmake (list
      '(0 . "LINE")
      (cons 10 (list -0.3 0.4 0.0))
      (cons 11 (list -0.3 -0.4 0.0))))
    (entmake (list
      '(0 . "TEXT")
      (cons 10 (list -0.12 -0.15 0.0))
      '(40 . 0.3)
      '(1 . "P")))
    (entmake '((0 . "ENDBLK") (2 . "PARKING_SIGN")))
  )
)`;
