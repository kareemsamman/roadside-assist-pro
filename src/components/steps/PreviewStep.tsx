import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, XCircle, CheckCircle2, TriangleAlert } from "lucide-react";
import { useWorkflow } from "@/context/WorkflowContext";
import { CADCanvas } from "@/components/CADCanvas";
import { detectClashes } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function PreviewStep() {
  const { state, dispatch, goToStep } = useWorkflow();
  const { uploadData, generatedBays, clashResults, approvedBayIds } = state;
  const [detecting, setDetecting] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    if (!hasRun && uploadData && generatedBays.length > 0) {
      runClashDetection();
    }
  }, []);

  const runClashDetection = async () => {
    if (!uploadData) return;
    setDetecting(true);
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const result = await detectClashes(uploadData.fileId, generatedBays);
      dispatch({ type: "SET_CLASH_RESULTS", clashes: result.clashes });
      setHasRun(true);
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Clash detection failed" });
    }
    dispatch({ type: "SET_LOADING", loading: false });
    setDetecting(false);
  };

  if (!uploadData) {
    return <p className="text-muted-foreground">No data loaded.</p>;
  }

  const errors = clashResults.filter((c) => c.severity === "error");
  const warnings = clashResults.filter((c) => c.severity === "warning");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Preview & Clash Detection</h1>
          <p className="text-muted-foreground mt-1">
            Review generated bays and resolve conflicts before export.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runClashDetection} disabled={detecting}>
            {detecting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Re-run Detection
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <CADCanvas
            polylines={uploadData.polylines}
            bays={generatedBays}
            clashes={clashResults}
            approvedBayIds={approvedBayIds}
            bounds={uploadData.bounds}
            className="h-[500px]"
          />
        </div>

        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-mono font-bold text-success">{generatedBays.length - errors.length}</p>
                <p className="text-xs text-muted-foreground">Valid</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-mono font-bold text-destructive">{errors.length}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-mono font-bold text-warning">{warnings.length}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </CardContent>
            </Card>
          </div>

          {/* Clash list */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Conflicts ({clashResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clashResults.length === 0 && hasRun && (
                <div className="flex items-center gap-2 text-success text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  No conflicts detected
                </div>
              )}
              {detecting && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing…
                </div>
              )}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {clashResults.map((clash) => (
                  <div
                    key={clash.id}
                    className={cn(
                      "rounded-md border p-2.5 text-sm",
                      clash.severity === "error"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-warning/30 bg-warning/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {clash.severity === "error" ? (
                        <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      ) : (
                        <TriangleAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{clash.bayNumber}</p>
                        <p className="text-xs text-muted-foreground">{clash.description}</p>
                        {clash.conflictEntityLayer && (
                          <Badge variant="outline" className="mt-1 text-xs font-mono">
                            {clash.conflictEntityLayer}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs shrink-0"
                        onClick={() => dispatch({ type: "TOGGLE_BAY_APPROVAL", bayId: clash.bayId })}
                      >
                        {approvedBayIds.has(clash.bayId) ? "Reject" : "Force"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Bay list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Parking Bays ({generatedBays.length})</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => dispatch({ type: "APPROVE_ALL_VALID" })}>
                Reset Approvals
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {generatedBays.map((bay) => {
                  const hasError = errors.some((c) => c.bayId === bay.id);
                  const hasWarn = warnings.some((c) => c.bayId === bay.id);
                  const approved = approvedBayIds.has(bay.id);
                  return (
                    <div
                      key={bay.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{bay.number}</span>
                        {hasError && <XCircle className="h-3 w-3 text-destructive" />}
                        {hasWarn && !hasError && <AlertTriangle className="h-3 w-3 text-warning" />}
                      </div>
                      <Badge variant={approved ? "default" : "secondary"} className="text-xs">
                        {approved ? "Approved" : "Rejected"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => goToStep("configure")}>Back</Button>
            <Button onClick={() => goToStep("export")} disabled={approvedBayIds.size === 0}>
              Continue to Export ({approvedBayIds.size} bays)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
