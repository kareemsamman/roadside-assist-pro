import { useCallback, useState } from "react";
import { FileUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkflow } from "@/context/WorkflowContext";
import { uploadDWGFile } from "@/lib/api-client";

export function UploadStep() {
  const { state, dispatch, goToStep } = useWorkflow();
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");

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

        const result = await uploadDWGFile(file);
        dispatch({
          type: "SET_UPLOAD",
          fileId: result.fileId,
          filename: result.filename,
          fileSize: result.fileSize,
        });

        setUploadProgress("done");
        dispatch({ type: "SET_LOADING", loading: false });
      } catch (err) {
        dispatch({
          type: "SET_ERROR",
          error: err instanceof Error ? err.message : "Upload failed",
        });
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
        <h1 className="text-2xl font-semibold">Upload DWG Drawing</h1>
        <p className="text-muted-foreground mt-1">
          Upload a DWG file containing highway geometry to begin.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <label
            htmlFor="cad-file-input"
            className={`flex flex-col items-center justify-center min-h-[280px] cursor-pointer border-2 border-dashed rounded-lg transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            } ${uploadProgress !== "idle" ? "pointer-events-none" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
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
                <p className="text-lg font-medium">Drop DWG file here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
              </>
            )}

            {uploadProgress === "uploading" && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-medium">Uploading DWG to server...</p>
              </div>
            )}

            {uploadProgress === "done" && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="font-medium text-success">Upload complete</p>
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

      {state.fileId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">File Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Filename</p>
                <p className="font-mono truncate">{state.filename}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Size</p>
                <p className="font-mono">
                  {state.fileSize ? `${(state.fileSize / 1e6).toFixed(2)} MB` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Format</p>
                <p className="font-mono uppercase">DWG</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadProgress === "done" && (
        <div className="flex justify-end">
          <Button onClick={() => goToStep("configure")}>
            Continue to Parking Rules
          </Button>
        </div>
      )}
    </div>
  );
}
