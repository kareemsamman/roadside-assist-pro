import React, { useRef, useEffect, useCallback, useState } from "react";
import type { Polyline, ParkingBay, Point2D, ClashResult, RoadEdgeCandidate } from "@/types/cad";

interface CADCanvasProps {
  polylines: Polyline[];
  bays?: ParkingBay[];
  clashes?: ClashResult[];
  approvedBayIds?: Set<string>;
  edgeCandidates?: RoadEdgeCandidate[];
  selectedEdgeId?: string | null;
  onSelectEdge?: (edgeId: string) => void;
  bounds: { min: Point2D; max: Point2D };
  className?: string;
}

const LAYER_COLORS: Record<string, string> = {
  ROAD_CENTERLINE: "#f59e0b",
  ROAD_EDGE_LEFT: "#22c55e",
  ROAD_EDGE_RIGHT: "#22c55e",
  CURB: "#6b7280",
  BARRIERS: "#ef4444",
  ROAD_MARKINGS: "#f8fafc",
  BLOCKS: "#a855f7",
};

function getLayerColor(layer: string): string {
  return LAYER_COLORS[layer] || "#64748b";
}

export function CADCanvas({
  polylines,
  bays = [],
  clashes = [],
  approvedBayIds,
  edgeCandidates,
  selectedEdgeId,
  onSelectEdge,
  bounds,
  className = "",
}: CADCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 500 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const clashBayIds = new Set(clashes.filter((c) => c.severity === "error").map((c) => c.bayId));
  const warnBayIds = new Set(clashes.filter((c) => c.severity === "warning").map((c) => c.bayId));

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Compute transform
  const getTransform = useCallback(() => {
    const w = bounds.max.x - bounds.min.x || 400;
    const h = bounds.max.y - bounds.min.y || 400;
    const padding = 40;
    const scaleX = (size.width - padding * 2) / w;
    const scaleY = (size.height - padding * 2) / h;
    const scale = Math.min(scaleX, scaleY) * zoom;
    const cx = size.width / 2 + pan.x;
    const cy = size.height / 2 + pan.y;
    const ox = bounds.min.x + w / 2;
    const oy = bounds.min.y + h / 2;
    return { scale, cx, cy, ox, oy };
  }, [bounds, size, zoom, pan]);

  const worldToScreen = useCallback(
    (p: Point2D) => {
      const t = getTransform();
      return {
        x: t.cx + (p.x - t.ox) * t.scale,
        y: t.cy + (p.y - t.oy) * t.scale,
      };
    },
    [getTransform]
  );

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#0f1729";
    ctx.fillRect(0, 0, size.width, size.height);

    // Grid
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    const gridSize = 50 * zoom * (getTransform().scale / zoom);
    if (gridSize > 10) {
      const startX = pan.x % gridSize;
      const startY = pan.y % gridSize;
      for (let x = startX; x < size.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size.height);
        ctx.stroke();
      }
      for (let y = startY; y < size.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size.width, y);
        ctx.stroke();
      }
    }

    // Draw polylines
    polylines.forEach((pl) => {
      if (pl.points.length < 2) return;
      const isSelectedEdge = edgeCandidates?.some((ec) => ec.id === selectedEdgeId && ec.polyline.id === pl.id);
      ctx.strokeStyle = isSelectedEdge ? "#3b82f6" : getLayerColor(pl.layer);
      ctx.lineWidth = isSelectedEdge ? 3 : 1.5;
      ctx.beginPath();
      const s = worldToScreen(pl.points[0]);
      ctx.moveTo(s.x, s.y);
      for (let i = 1; i < pl.points.length; i++) {
        const p = worldToScreen(pl.points[i]);
        ctx.lineTo(p.x, p.y);
      }
      if (pl.closed) ctx.closePath();
      ctx.stroke();

      // If edge candidate and hoverable, draw wider
      if (edgeCandidates && onSelectEdge) {
        const ec = edgeCandidates.find((e) => e.polyline.id === pl.id);
        if (ec && ec.id !== selectedEdgeId) {
          ctx.strokeStyle = getLayerColor(pl.layer) + "40";
          ctx.lineWidth = 8;
          ctx.beginPath();
          const s2 = worldToScreen(pl.points[0]);
          ctx.moveTo(s2.x, s2.y);
          for (let i = 1; i < pl.points.length; i++) {
            const p = worldToScreen(pl.points[i]);
            ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        }
      }
    });

    // Draw parking bays
    bays.forEach((bay) => {
      const isClash = clashBayIds.has(bay.id);
      const isWarn = warnBayIds.has(bay.id);
      const isApproved = approvedBayIds?.has(bay.id) ?? true;

      let fillColor = "rgba(34, 197, 94, 0.25)";
      let strokeColor = "#22c55e";

      if (isClash) {
        fillColor = "rgba(239, 68, 68, 0.3)";
        strokeColor = "#ef4444";
      } else if (isWarn) {
        fillColor = "rgba(245, 158, 11, 0.25)";
        strokeColor = "#f59e0b";
      } else if (!isApproved) {
        fillColor = "rgba(100, 116, 139, 0.2)";
        strokeColor = "#64748b";
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const c0 = worldToScreen(bay.corners[0]);
      ctx.moveTo(c0.x, c0.y);
      for (let i = 1; i < 4; i++) {
        const ci = worldToScreen(bay.corners[i]);
        ctx.lineTo(ci.x, ci.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bay number
      const sc = worldToScreen(bay.center);
      ctx.fillStyle = strokeColor;
      ctx.font = `${Math.max(10, 12 * zoom)}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bay.number, sc.x, sc.y);

      // Pole marker
      if (bay.polePosition) {
        const pp = worldToScreen(bay.polePosition);
        ctx.fillStyle = "#a855f7";
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Coordinate readout
    ctx.fillStyle = "#475569";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Zoom: ${(zoom * 100).toFixed(0)}%`, 8, size.height - 8);
  }, [polylines, bays, clashes, approvedBayIds, size, pan, zoom, edgeCandidates, selectedEdgeId, worldToScreen, getTransform]);

  // Mouse handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.1, Math.min(10, z * (1 - e.deltaY * 0.001))));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPan((p) => ({
      x: p.x + (e.clientX - lastMouse.current.x),
      y: p.y + (e.clientY - lastMouse.current.y),
    }));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-md border border-border bg-card ${className}`}
      style={{ minHeight: 400 }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size.width, height: size.height, cursor: isDragging.current ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(10, z * 1.3))}
          className="rounded bg-secondary px-2 py-1 text-xs font-mono text-secondary-foreground hover:bg-secondary/80"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.1, z / 1.3))}
          className="rounded bg-secondary px-2 py-1 text-xs font-mono text-secondary-foreground hover:bg-secondary/80"
        >
          −
        </button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="rounded bg-secondary px-2 py-1 text-xs font-mono text-secondary-foreground hover:bg-secondary/80"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
