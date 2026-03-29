import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkflow } from "@/context/WorkflowContext";
import { CADCanvas } from "@/components/CADCanvas";
import { cn } from "@/lib/utils";

export function AnalyzeStep() {
  const { state, dispatch, goToStep } = useWorkflow();
  const { uploadData, roadAnalysis, selectedEdgeId } = state;

  if (!uploadData || !roadAnalysis) {
    return <p className="text-muted-foreground">No data available. Please upload a file first.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Road Analysis</h1>
        <p className="text-muted-foreground mt-1">
          Review detected road edges and select the parking-side edge.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <CADCanvas
            polylines={uploadData.polylines}
            bounds={uploadData.bounds}
            edgeCandidates={roadAnalysis.edgeCandidates}
            selectedEdgeId={selectedEdgeId}
            className="h-[500px]"
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Road Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Centerline</span>
                <Badge variant={roadAnalysis.centerline ? "default" : "secondary"}>
                  {roadAnalysis.centerline ? "Detected" : "Not found"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Road Width</span>
                <span className="font-mono">{roadAnalysis.roadWidth ? `${roadAnalysis.roadWidth} m` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Direction</span>
                <span className="font-mono capitalize">{roadAnalysis.direction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Edge Candidates</span>
                <span className="font-mono">{roadAnalysis.edgeCandidates.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Parking Edge</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {roadAnalysis.edgeCandidates.map((ec) => (
                <button
                  key={ec.id}
                  onClick={() => dispatch({ type: "SET_SELECTED_EDGE", edgeId: ec.id })}
                  className={cn(
                    "w-full text-left rounded-md border p-3 text-sm transition-colors",
                    selectedEdgeId === ec.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{ec.label}</span>
                    <Badge variant="outline" className="ml-2 font-mono text-xs shrink-0">
                      {(ec.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">{ec.type.replace("_", " ")}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parking Side</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(["left", "right"] as const).map((side) => (
                  <Button
                    key={side}
                    variant={state.parkingSide === side ? "default" : "outline"}
                    className="flex-1 capitalize"
                    onClick={() => dispatch({ type: "SET_PARKING_SIDE", side })}
                  >
                    {side}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => goToStep("upload")}>Back</Button>
            <Button onClick={() => goToStep("configure")} disabled={!selectedEdgeId}>
              Configure Parking
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
