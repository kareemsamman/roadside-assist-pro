import { useCallback, useState } from "react";
import { FileUp, AlertCircle, CheckCircle2, Loader2, FileCheck, HardDrive, Hash, Layers } from "lucide-react";
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
                <p className="text-lg font-medium">Drop DWG or DXF file here</p>
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
        <>
          {/* File Preview Area */}
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center min-h-[200px] bg-muted/30 rounded-lg border border-dashed border-border">
                <div className="relative mb-3">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 64 64"
                    fill="none"
                    className="text-primary"
                  >
                    <rect x="4" y="4" width="56" height="56" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    <line x1="4" y1="16" x2="60" y2="16" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <line x1="4" y1="28" x2="60" y2="28" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <line x1="4" y1="40" x2="60" y2="40" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <line x1="4" y1="52" x2="60" y2="52" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <line x1="16" y1="4" x2="16" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <line x1="28" y1="4" x2="28" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <line x1="40" y1="4" x2="40" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <line x1="52" y1="4" x2="52" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                    <path d="M12 48 L20 32 L32 44 L44 24 L52 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="18" y="20" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
                    <rect x="36" y="38" width="16" height="10" rx="1" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.6" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground">{state.filename}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  DWG preview requires AutoCAD — file will be processed in the Generate step
                </p>
              </div>
            </CardContent>
          </Card>

          {/* File Details */}
          <Card className="border-emerald-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-400">
                <FileCheck className="h-4 w-4" />
                File Uploaded Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">Filename</p>
                    <p className="font-mono truncate text-foreground">{state.filename}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Size</p>
                    <p className="font-mono text-foreground">
                      {state.fileSize
                        ? state.fileSize > 1e6
                          ? `${(state.fileSize / 1e6).toFixed(2)} MB`
                          : `${(state.fileSize / 1e3).toFixed(1)} KB`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">File ID</p>
                    <p className="font-mono truncate text-foreground">{state.fileId.slice(0, 12)}...</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Format</p>
                    <p className="font-mono uppercase text-foreground">AutoCAD DWG</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
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
