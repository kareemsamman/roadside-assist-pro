import { useCallback, useState } from "react";
import { Upload, FileUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkflow } from "@/context/WorkflowContext";
import { uploadCADFile, analyzeRoad, isUsingMockMode } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";

export function UploadStep() {
  const { state, dispatch, goToStep } = useWorkflow();
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "analyzing" | "done">("idle");

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "dwg" && ext !== "dxf") {
        dispatch({ type: "SET_ERROR", error: "Only DWG and DXF files are supported." });
        return;
      }

      try {
        dispatch({ type: "SET_LOADING", loading: true });
        setUploadProgress("uploading");

        const uploadData = await uploadCADFile(file);
        dispatch({ type: "SET_UPLOAD", data: uploadData });
        setUploadProgress("analyzing");

        const roadData = await analyzeRoad(uploadData.fileId);
        dispatch({ type: "SET_ROAD_ANALYSIS", data: roadData });

        if (roadData.edgeCandidates.length > 0) {
          const best = roadData.edgeCandidates.reduce((a, b) => (a.confidence > b.confidence ? a : b));
          dispatch({ type: "SET_SELECTED_EDGE", edgeId: best.id });
        }

        setUploadProgress("done");
        dispatch({ type: "SET_LOADING", loading: false });
      } catch (err) {
        dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Upload failed" });
        setUploadProgress("idle");
      }
    },
    [dispatch]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Upload CAD Drawing</h1>
        <p className="text-muted-foreground mt-1">
          Upload a DWG or DXF file containing highway geometry to begin.
        </p>
      </div>

      {isUsingMockMode() && (
        <div className="rounded-md bg-warning/10 border border-warning/30 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-warning">Demo Mode</span>
            <span className="text-muted-foreground"> — No backend connected. Using sample road geometry for demonstration.</span>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <label
            htmlFor="cad-file-input"
            className={`flex flex-col items-center justify-center min-h-[280px] cursor-pointer border-2 border-dashed rounded-lg transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            } ${uploadProgress !== "idle" ? "pointer-events-none" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              id="cad-file-input"
              type="file"
              accept=".dwg,.dxf"
              className="hidden"
              onChange={handleInputChange}
              disabled={uploadProgress !== "idle" && uploadProgress !== "done"}
            />

            {uploadProgress === "idle" && (
              <>
                <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Drop DWG or DXF file here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </>
            )}

            {uploadProgress === "uploading" && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-medium">Uploading and parsing CAD file…</p>
              </div>
            )}

            {uploadProgress === "analyzing" && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-medium">Analyzing road geometry…</p>
              </div>
            )}

            {uploadProgress === "done" && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="font-medium text-success">Analysis complete</p>
              </div>
            )}
          </label>
        </CardContent>
      </Card>

      {state.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <p className="text-sm text-destructive">{state.error}</p>
        </div>
      )}

      {state.uploadData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">File Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Filename</p>
                <p className="font-mono truncate">{state.uploadData.filename}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Size</p>
                <p className="font-mono">{(state.uploadData.fileSize / 1e6).toFixed(2)} MB</p>
              </div>
              <div>
                <p className="text-muted-foreground">Format</p>
                <p className="font-mono uppercase">{state.uploadData.format}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Layers</p>
                <p className="font-mono">{state.uploadData.layers.length}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-muted-foreground text-sm mb-2">Detected Layers</p>
              <div className="flex flex-wrap gap-1.5">
                {state.uploadData.layers.map((layer) => (
                  <Badge key={layer.name} variant="secondary" className="font-mono text-xs">
                    {layer.name} ({layer.entityCount})
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadProgress === "done" && (
        <div className="flex justify-end">
          <Button onClick={() => goToStep("analyze")}>
            Continue to Road Analysis
          </Button>
        </div>
      )}
    </div>
  );
}
