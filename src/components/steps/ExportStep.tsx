import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileDown,
  RotateCcw,
  Wifi,
  WifiOff,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useWorkflow } from "@/context/WorkflowContext";
import { getDownloadStatus, getDownloadUrl } from "@/lib/api-client";
import { DwgViewer } from "@/components/DwgViewer";

interface LogEntry {
  id: number;
  timestamp: Date;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

let logIdCounter = 0;

export function ExportStep() {
  const { state, dispatch, goToStep } = useWorkflow();
  const { jobId, jobStatus, jobProgress, jobError, filename, parkingRules, viewerUrn, outputUrn } = state;
  const [downloadReady, setDownloadReady] = useState(false);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef<string | null>(null);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    setActivityLog((prev) => [
      ...prev,
      { id: ++logIdCounter, timestamp: new Date(), message, type },
    ]);
  }, []);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activityLog]);

  // Poll for job status
  useEffect(() => {
    if (!jobId) return;

    addLog(`Job started — ID: ${jobId.slice(0, 12)}...`, "info");

    const poll = async () => {
      setPollCount((c) => c + 1);

      try {
        const result = await getDownloadStatus(jobId);
        setConnected(true);

        if (result === "file") {
          dispatch({
            type: "SET_JOB_STATUS",
            status: "complete",
            progress: 100,
          });
          setDownloadReady(true);
          addLog("File ready — download started", "success");
          if (pollingRef.current) clearInterval(pollingRef.current);
          return;
        }

        const progress = result.progress ?? 0;
        const status = result.status ?? "processing";

        // Log status transitions
        if (status !== prevStatusRef.current) {
          const label = statusLabel[status] || status;
          if (status === "failed") {
            addLog(`${label}: ${result.error || "Unknown error"}`, "error");
          } else if (status === "complete") {
            addLog(label, "success");
          } else {
            addLog(label, "info");
          }
          prevStatusRef.current = status;
        }

        dispatch({
          type: "SET_JOB_STATUS",
          status,
          progress,
          error: result.error,
          outputUrn: result.outputUrn,
        });

        if (result.ready) {
          setDownloadReady(true);
          addLog("Output file is ready for download", "success");
          if (pollingRef.current) clearInterval(pollingRef.current);
        }

        if (status === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
        setConnected(false);
        const msg = err instanceof Error ? err.message : "Unknown error";
        addLog(`Connection error: ${msg}`, "error");
        console.error("Status poll failed:", err);
      }
    };

    // Initial check
    poll();

    // Poll every 3 seconds while processing
    pollingRef.current = setInterval(poll, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, dispatch]);

  const handleDownload = () => {
    if (!jobId) return;
    const url = getDownloadUrl(jobId);
    window.open(url, "_blank");
  };

  const statusLabel: Record<string, string> = {
    pending: "Queued",
    uploading: "Uploading to Autodesk...",
    extracting: "Extracting road geometry from DWG...",
    computing: "Computing parking bay positions...",
    processing: "AutoCAD is drawing parking bays...",
    complete: "Processing complete",
    failed: "Processing failed",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Generate & Download</h1>
        <p className="text-muted-foreground mt-1">
          Your DWG is being processed by Autodesk AutoCAD with accessible parking bays.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Job Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Processing Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {jobStatus === "complete" ? (
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                ) : jobStatus === "failed" ? (
                  <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-primary shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {statusLabel[jobStatus || "pending"] || "Processing..."}
                  </p>
                  {jobStatus !== "complete" && jobStatus !== "failed" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This may take 1-3 minutes depending on drawing complexity.
                    </p>
                  )}
                </div>
              </div>

              {jobStatus !== "complete" && jobStatus !== "failed" && (
                <Progress value={jobProgress} className="h-2" />
              )}

              {jobStatus === "failed" && jobError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  {jobError}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration Used</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Source File</dt>
                  <dd className="font-mono truncate ml-4">{filename}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bay Size</dt>
                  <dd className="font-mono">
                    {parkingRules.bayWidth} x {parkingRules.bayLength} m
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Spacing</dt>
                  <dd className="font-mono">{parkingRules.spacing} m</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Side</dt>
                  <dd className="font-mono capitalize">{parkingRules.side}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Orientation</dt>
                  <dd className="font-mono capitalize">{parkingRules.orientation}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Blocks</dt>
                  <dd className="flex gap-1">
                    {parkingRules.insertPole && (
                      <Badge variant="secondary" className="text-xs">
                        Pole
                      </Badge>
                    )}
                    {parkingRules.insertSign && (
                      <Badge variant="secondary" className="text-xs">
                        Sign
                      </Badge>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Download */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Download DWG</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {downloadReady ? (
                <div className="text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
                  <p className="font-medium">Your DWG file is ready</p>
                  <p className="text-sm text-muted-foreground">
                    The drawing has been processed with accessible parking bays added
                    to dedicated layers.
                  </p>
                  <Button onClick={handleDownload} className="w-full" size="lg">
                    <FileDown className="h-4 w-4 mr-2" />
                    Download DWG
                  </Button>
                </div>
              ) : jobStatus === "failed" ? (
                <div className="text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                  <p className="font-medium">Processing failed</p>
                  <p className="text-sm text-muted-foreground">
                    Go back to adjust your configuration and try again.
                  </p>
                </div>
              ) : (
                <div className="text-center space-y-4 py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
                  <p className="font-medium">Processing with AutoCAD...</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {jobProgress}% complete
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => goToStep("configure")}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Adjust Rules
            </Button>
            <Button variant="outline" onClick={() => dispatch({ type: "RESET" })}>
              Start New Project
            </Button>
          </div>
        </div>
      </div>

      {/* Before / After DWG Viewer */}
      {(viewerUrn || outputUrn) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Drawing Preview — Before & After
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Before */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Before</Badge>
                  <span className="text-xs text-muted-foreground truncate">{filename}</span>
                </div>
                {viewerUrn ? (
                  <DwgViewer urn={viewerUrn} />
                ) : (
                  <div className="flex items-center justify-center h-[300px] bg-muted/30 rounded-lg border border-dashed border-border">
                    <p className="text-sm text-muted-foreground">Original viewer not available</p>
                  </div>
                )}
              </div>

              {/* After */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-primary">After</Badge>
                  <span className="text-xs text-muted-foreground">With parking bays</span>
                </div>
                {outputUrn ? (
                  <DwgViewer urn={outputUrn} />
                ) : jobStatus === "complete" ? (
                  <div className="flex items-center justify-center h-[300px] bg-muted/30 rounded-lg border border-dashed border-border">
                    <p className="text-sm text-muted-foreground text-center px-4">
                      Output viewer not available.<br />
                      <span className="text-xs">Backend needs to translate the output DWG for viewing.</span>
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[300px] bg-muted/30 rounded-lg border border-dashed border-border">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                    <p className="text-sm text-muted-foreground">Processing...</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity Log
            </CardTitle>
            <div className="flex items-center gap-2 text-xs">
              {connected ? (
                <span className="flex items-center gap-1 text-emerald-500">
                  <Wifi className="h-3.5 w-3.5" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1 text-destructive">
                  <WifiOff className="h-3.5 w-3.5" />
                  Disconnected
                </span>
              )}
              <span className="text-muted-foreground">
                ({pollCount} {pollCount === 1 ? "poll" : "polls"})
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-md border max-h-48 overflow-y-auto font-mono text-xs">
            {activityLog.length === 0 ? (
              <p className="text-muted-foreground p-3">Waiting for activity...</p>
            ) : (
              <div className="divide-y divide-border/50">
                {activityLog.map((entry) => (
                  <div key={entry.id} className="flex gap-2 px-3 py-1.5">
                    <span className="text-muted-foreground shrink-0">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                    <span
                      className={
                        entry.type === "error"
                          ? "text-destructive"
                          : entry.type === "success"
                          ? "text-emerald-500"
                          : entry.type === "warning"
                          ? "text-yellow-500"
                          : "text-foreground"
                      }
                    >
                      {entry.message}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
