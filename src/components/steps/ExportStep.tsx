import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useWorkflow } from "@/context/WorkflowContext";
import { getDownloadStatus, getDownloadUrl } from "@/lib/api-client";

export function ExportStep() {
  const { state, dispatch, goToStep } = useWorkflow();
  const { jobId, jobStatus, jobProgress, jobError, filename, parkingRules } = state;
  const [downloadReady, setDownloadReady] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for job status
  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const result = await getDownloadStatus(jobId);

        if (result === "file") {
          // File was downloaded directly
          dispatch({
            type: "SET_JOB_STATUS",
            status: "complete",
            progress: 100,
          });
          setDownloadReady(true);
          if (pollingRef.current) clearInterval(pollingRef.current);
          return;
        }

        dispatch({
          type: "SET_JOB_STATUS",
          status: result.status,
          progress: result.progress,
          error: result.error,
        });

        if (result.ready) {
          setDownloadReady(true);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }

        if (result.status === "failed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
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
    </div>
  );
}
