import { Upload, Settings, Download, ChevronRight } from "lucide-react";
import { useWorkflow } from "@/context/WorkflowContext";
import type { WorkflowStep } from "@/types/cad";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const STEPS: { step: WorkflowStep; label: string; icon: typeof Upload }[] = [
  { step: "upload", label: "Upload DWG", icon: Upload },
  { step: "configure", label: "Parking Rules", icon: Settings },
  { step: "export", label: "Generate & Download", icon: Download },
];

export function AppSidebar() {
  const { state, goToStep, canGoToStep } = useWorkflow();
  const { state: sidebarState } = useSidebar();
  const collapsed = sidebarState === "collapsed";

  const currentIdx = STEPS.findIndex((s) => s.step === state.currentStep);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider">
            {!collapsed && "Workflow"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {STEPS.map((item, idx) => {
                const isActive = state.currentStep === item.step;
                const isComplete = idx < currentIdx;
                const isDisabled = !canGoToStep(item.step);

                return (
                  <SidebarMenuItem key={item.step}>
                    <SidebarMenuButton
                      onClick={() => goToStep(item.step)}
                      disabled={isDisabled}
                      className={cn(
                        "relative transition-colors",
                        isActive && "bg-sidebar-accent text-sidebar-primary font-semibold",
                        isComplete && "text-sidebar-primary",
                        isDisabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono",
                            isActive && "bg-sidebar-primary text-sidebar-primary-foreground",
                            isComplete && "bg-sidebar-primary/20 text-sidebar-primary",
                            !isActive && !isComplete && "bg-sidebar-accent text-sidebar-foreground"
                          )}
                        >
                          {isComplete ? "\u2713" : idx + 1}
                        </div>
                        {!collapsed && <span>{item.label}</span>}
                      </div>
                      {isActive && !collapsed && (
                        <ChevronRight className="ml-auto h-4 w-4 text-sidebar-primary" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="px-3 py-2">
                <div className="rounded-md bg-sidebar-accent p-3 text-xs text-sidebar-foreground/70">
                  <p className="font-medium text-sidebar-foreground mb-1">
                    {state.fileId ? "File Loaded" : "No File"}
                  </p>
                  {state.fileId && (
                    <>
                      <p className="truncate">{state.filename}</p>
                      {state.fileSize && (
                        <p>{(state.fileSize / 1e6).toFixed(1)} MB</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
