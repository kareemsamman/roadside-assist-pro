import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, Eye } from "lucide-react";
import { getViewerToken, getTranslationStatus } from "@/lib/api-client";

declare global {
  interface Window {
    Autodesk: typeof Autodesk;
  }
}

declare namespace Autodesk {
  namespace Viewing {
    function Initializer(
      options: Record<string, unknown>,
      callback: () => void
    ): void;
    class GuiViewer3D {
      constructor(container: HTMLElement);
      start(): void;
      finish(): void;
      loadDocumentNode(
        doc: Document,
        viewable: Record<string, unknown>
      ): void;
    }
    class Document {
      static load(
        urn: string,
        onSuccess: (doc: Document) => void,
        onError: (code: number, msg: string) => void
      ): void;
      getRoot(): {
        getDefaultGeometry(): Record<string, unknown>;
      };
    }
  }
}

interface DwgViewerProps {
  urn: string;
}

type ViewerState = "translating" | "ready" | "loading" | "loaded" | "error";

export function DwgViewer({ urn }: DwgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null);
  const [viewerState, setViewerState] = useState<ViewerState>("translating");
  const [translationProgress, setTranslationProgress] = useState("0%");
  const [errorMsg, setErrorMsg] = useState("");

  // Poll translation status
  useEffect(() => {
    if (!urn) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const checkStatus = async () => {
      try {
        const result = await getTranslationStatus(urn);
        if (cancelled) return;

        if (result.status === "success") {
          setViewerState("ready");
          return;
        }
        if (result.status === "failed") {
          setViewerState("error");
          setErrorMsg("Translation failed — the DWG file could not be processed for viewing.");
          return;
        }

        setTranslationProgress(result.progress || "0%");
        timer = setTimeout(checkStatus, 3000);
      } catch {
        if (cancelled) return;
        // May not be available yet, keep polling
        timer = setTimeout(checkStatus, 3000);
      }
    };

    checkStatus();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [urn]);

  // Initialize viewer when translation is ready
  const initViewer = useCallback(async () => {
    if (!containerRef.current || viewerState !== "ready") return;
    if (!window.Autodesk) {
      setViewerState("error");
      setErrorMsg("Autodesk Viewer SDK failed to load.");
      return;
    }

    setViewerState("loading");

    try {
      const tokenData = await getViewerToken();

      const options = {
        env: "AutodeskProduction2",
        api: "streamingV2",
        getAccessToken: (
          callback: (token: string, expires: number) => void
        ) => {
          callback(tokenData.access_token, tokenData.expires_in);
        },
      };

      window.Autodesk.Viewing.Initializer(options, () => {
        if (!containerRef.current) return;

        const viewer = new window.Autodesk.Viewing.GuiViewer3D(
          containerRef.current
        );
        viewer.start();
        viewerRef.current = viewer;

        const documentId = `urn:${urn}`;
        window.Autodesk.Viewing.Document.load(
          documentId,
          (doc) => {
            const viewable = doc.getRoot().getDefaultGeometry();
            viewer.loadDocumentNode(doc, viewable);
            setViewerState("loaded");
          },
          (_code, msg) => {
            setViewerState("error");
            setErrorMsg(`Failed to load document: ${msg}`);
          }
        );
      });
    } catch (err) {
      setViewerState("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to initialize viewer"
      );
    }
  }, [urn, viewerState]);

  useEffect(() => {
    if (viewerState === "ready") {
      initViewer();
    }
  }, [viewerState, initViewer]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30">
      {/* Viewer container */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: "400px" }}
      />

      {/* Overlay states */}
      {viewerState !== "loaded" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          {viewerState === "translating" && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm font-medium">Preparing DWG for viewing...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Translation progress: {translationProgress}
              </p>
            </>
          )}

          {(viewerState === "ready" || viewerState === "loading") && (
            <>
              <Eye className="h-8 w-8 text-primary mb-3 animate-pulse" />
              <p className="text-sm font-medium">Loading Autodesk Viewer...</p>
            </>
          )}

          {viewerState === "error" && (
            <>
              <AlertCircle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm font-medium text-destructive">
                Viewer Error
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
                {errorMsg}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
