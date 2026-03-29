import type { ExtractedGeometry, ExtractedPolyline, Point2D } from "../types.js";

/**
 * Road-related layer name patterns.
 * Used to score polylines when selecting the road edge candidate.
 */
const ROAD_LAYER_PATTERNS = [
  /road/i,
  /edge/i,
  /curb/i,
  /kerb/i,
  /shoulder/i,
  /boundary/i,
  /centerline/i,
  /centre/i,
  /center/i,
  /carriage/i,
  /pavement/i,
  /highway/i,
];

/**
 * Generate an AutoCAD script (.scr) with embedded AutoLISP that extracts
 * all LWPOLYLINE geometry from the opened DWG and writes it to "extracted.json".
 *
 * Uses (chr 34) for quote characters to avoid all escaping issues between
 * TypeScript string literals, .scr file format, and LISP string syntax.
 */
export function generateExtractionScript(): string {
  // The entire extraction is a single LISP progn block.
  // (chr 34) produces the " character inside LISP strings.
  return `(progn
  (setq qt (chr 34))
  (setq fp (open "extracted.json" "w"))
  (princ (strcat "{" qt "polylines" qt ":[") fp)
  (setq ss (ssget "X" (list (cons 0 "LWPOLYLINE"))))
  (setq first-ent T)
  (if ss
    (progn
      (setq idx 0)
      (repeat (sslength ss)
        (setq ed (entget (ssname ss idx)))
        (setq hnd (cdr (assoc 5 ed)))
        (setq lyr (cdr (assoc 8 ed)))
        (setq flg (cdr (assoc 70 ed)))
        (setq cls (if (= (logand (if flg flg 0) 1) 1) "true" "false"))
        (if (not first-ent) (princ "," fp))
        (setq first-ent nil)
        (princ (strcat
          "{" qt "id" qt ":" qt hnd qt
          "," qt "layer" qt ":" qt lyr qt
          "," qt "closed" qt ":" cls
          "," qt "points" qt ":["
        ) fp)
        (setq verts nil)
        (foreach pair ed
          (if (= (car pair) 10)
            (setq verts (append verts (list (cdr pair))))
          )
        )
        (setq first-pt T)
        (foreach v verts
          (if (not first-pt) (princ "," fp))
          (setq first-pt nil)
          (princ (strcat
            "{" qt "x" qt ":" (rtos (car v) 2 8)
            "," qt "y" qt ":" (rtos (cadr v) 2 8) "}"
          ) fp)
        )
        (princ "]}" fp)
        (setq idx (1+ idx))
      )
    )
  )
  (princ "]}" fp)
  (close fp)
  (princ)
)
`;
}

/**
 * Parse the JSON output produced by the extraction LISP script.
 */
export function parseExtractedGeometry(jsonString: string): ExtractedGeometry {
  const raw = JSON.parse(jsonString);

  if (!raw.polylines || !Array.isArray(raw.polylines)) {
    throw new Error("Invalid extraction output: missing polylines array");
  }

  const polylines: ExtractedPolyline[] = raw.polylines.map((pl: any) => ({
    id: String(pl.id),
    layer: String(pl.layer),
    closed: Boolean(pl.closed),
    points: (pl.points || []).map((pt: any) => ({
      x: Number(pt.x),
      y: Number(pt.y),
    })),
  }));

  return { polylines };
}

/**
 * Select the best road edge polyline from extracted geometry.
 *
 * Scoring heuristic:
 * 1. Must have >= 2 points
 * 2. Open polylines score higher than closed (road edges aren't closed)
 * 3. Layer name matching road patterns scores higher
 * 4. Longer polylines score higher (road edges are typically the longest features)
 * 5. Prefer polylines with more vertices (curved roads have many segments)
 *
 * Throws if no suitable polyline is found.
 */
export function selectRoadEdge(geometry: ExtractedGeometry): {
  polyline: ExtractedPolyline;
  edgePoints: Point2D[];
} {
  const candidates = geometry.polylines.filter((pl) => pl.points.length >= 2);

  if (candidates.length === 0) {
    throw new Error(
      "No polylines found in the uploaded DWG. The drawing must contain " +
      "LWPOLYLINE entities representing road geometry."
    );
  }

  const scored = candidates.map((pl) => {
    let score = 0;

    // Length score (dominant factor)
    const length = polylineLength(pl.points);
    score += length;

    // Open polylines are more likely to be road edges
    if (!pl.closed) {
      score += length * 0.5;
    }

    // Layer name heuristic
    const layerMatchCount = ROAD_LAYER_PATTERNS.filter((p) =>
      p.test(pl.layer)
    ).length;
    if (layerMatchCount > 0) {
      score += length * (0.3 * layerMatchCount);
    }

    // Vertex density bonus (curved roads have more vertices per unit length)
    if (length > 0) {
      const density = pl.points.length / length;
      score += density * 10;
    }

    return { polyline: pl, score, length };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  const best = scored[0];
  console.log(
    `[Extract] Selected edge: layer="${best.polyline.layer}" ` +
    `id="${best.polyline.id}" length=${best.length.toFixed(2)} ` +
    `points=${best.polyline.points.length} score=${best.score.toFixed(2)} ` +
    `(${scored.length} candidates)`
  );

  return {
    polyline: best.polyline,
    edgePoints: best.polyline.points,
  };
}

/**
 * Calculate the total length of a polyline.
 */
function polylineLength(points: Point2D[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}
