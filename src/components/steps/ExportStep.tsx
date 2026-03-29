import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, AlertTriangle, CheckCircle2, FileDown } from "lucide-react";
import { useWorkflow } from "@/context/WorkflowContext";
import { exportDrawing, isUsingMockMode } from "@/lib/api-client";

export function ExportStep() {
  const { state, dispatch, goToStep } = useWorkflow();
  const { uploadData, generatedBays, approvedBayIds, clashResults, parkingRules, selectedEdgeId } = state;
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ downloadUrl: string; filename: string } | null>(null);

  const approvedBays = generatedBays.filter((b) => approvedBayIds.has(b.id));
  const unresolvedErrors = clashResults.filter(
    (c) => c.severity === "error" && approvedBayIds.has(c.bayId)
  );

  const handleExport = async () => {
    if (!uploadData || !selectedEdgeId) return;
    setExporting(true);
    try {
      const result = await exportDrawing({
        fileId: uploadData.fileId,
        bays: approvedBays,
        approvedBayIds: Array.from(approvedBayIds),
        rules: parkingRules,
        selectedEdgeId,
      });
      setExportResult(result);
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Export failed" });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Export Drawing</h1>
        <p className="text-muted-foreground mt-1">
          Review the summary and download the final DWG file.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Source File</dt>
                  <dd className="font-mono truncate ml-4">{uploadData?.filename}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Total Bays Generated</dt>
                  <dd className="font-mono">{generatedBays.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Approved for Export</dt>
                  <dd className="font-mono font-bold text-success">{approvedBays.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Rejected / Removed</dt>
                  <dd className="font-mono">{generatedBays.length - approvedBays.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Bay Dimensions</dt>
                  <dd className="font-mono">{parkingRules.bayWidth} × {parkingRules.bayLength} m</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Numbering Range</dt>
                  <dd className="font-mono">
                    {approvedBays.length > 0
                      ? `${approvedBays[0].number} – ${approvedBays[approvedBays.length - 1].number}`
                      : "—"
                    }
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Blocks</dt>
                  <dd className="flex gap-1">
                    {parkingRules.insertPole && <Badge variant="secondary" className="text-xs">Pole</Badge>}
                    {parkingRules.insertSign && <Badge variant="secondary" className="text-xs">Sign</Badge>}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {unresolvedErrors.length > 0 && (
            <div className="rounded-md bg-warning/10 border border-warning/30 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-warning">
                  {unresolvedErrors.length} force-approved conflict{unresolvedErrors.length > 1 ? "s" : ""}
                </span>
                <p className="text-muted-foreground mt-0.5">
                  These bays have clashes that were force-approved. The exported geometry may contain overlapping entities.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Download</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!exportResult ? (
                <>
                  {isUsingMockMode() && (
                    <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                      Demo mode: Export will simulate a DWG file download. Connect a Python backend for real DWG output.
                    </p>
                  )}
                  <Button onClick={handleExport} disabled={exporting || approvedBays.length === 0} className="w-full" size="lg">
                    {exporting ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating DWG…</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" /> Export as DWG</>
                    )}
                  </Button>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
                  <p className="font-medium">Export complete</p>
                  <p className="text-sm text-muted-foreground font-mono">{exportResult.filename}</p>
                  <Button
                    onClick={() => {
                      if (exportResult.downloadUrl !== "#mock-download") {
                        window.open(exportResult.downloadUrl, "_blank");
                      }
                    }}
                    className="w-full"
                    size="lg"
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Download DWG
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => goToStep("preview")}>Back</Button>
            <Button variant="outline" onClick={() => dispatch({ type: "RESET" })}>
              Start New Project
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
