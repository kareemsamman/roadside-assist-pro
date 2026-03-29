import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { WorkflowProvider, useWorkflow } from "@/context/WorkflowContext";
import { AppSidebar } from "@/components/AppSidebar";
import { UploadStep } from "@/components/steps/UploadStep";
import { AnalyzeStep } from "@/components/steps/AnalyzeStep";
import { ConfigureStep } from "@/components/steps/ConfigureStep";
import { PreviewStep } from "@/components/steps/PreviewStep";
import { ExportStep } from "@/components/steps/ExportStep";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function WorkflowContent() {
  const { state } = useWorkflow();

  return (
    <>
      {state.currentStep === "upload" && <UploadStep />}
      {state.currentStep === "analyze" && <AnalyzeStep />}
      {state.currentStep === "configure" && <ConfigureStep />}
      {state.currentStep === "preview" && <PreviewStep />}
      {state.currentStep === "export" && <ExportStep />}
    </>
  );
}

function MainLayout() {
  return (
    <WorkflowProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full dark">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center border-b border-border bg-card px-4 shrink-0">
              <SidebarTrigger className="mr-3" />
              <h2 className="text-sm font-semibold tracking-tight truncate">
                Highway Accessible Parking Bay Generator
              </h2>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  v1.0 MVP
                </span>
              </div>
            </header>
            <main className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-7xl mx-auto">
                <WorkflowContent />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </WorkflowProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
