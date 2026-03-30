import React, { createContext, useContext, useReducer, useCallback } from "react";
import type {
  WorkflowState,
  WorkflowStep,
  ParkingRules,
  JobStatus,
} from "@/types/cad";
import { DEFAULT_PARKING_RULES } from "@/types/cad";

const INITIAL_STATE: WorkflowState = {
  currentStep: "upload",
  fileId: null,
  filename: null,
  fileSize: null,
  viewerUrn: null,
  parkingRules: DEFAULT_PARKING_RULES,
  jobId: null,
  jobStatus: null,
  jobProgress: 0,
  jobError: null,
  isLoading: false,
  error: null,
};

type Action =
  | { type: "SET_STEP"; step: WorkflowStep }
  | { type: "SET_UPLOAD"; fileId: string; filename: string; fileSize: number; viewerUrn?: string }
  | { type: "SET_PARKING_RULES"; rules: ParkingRules }
  | { type: "SET_JOB"; jobId: string }
  | { type: "SET_JOB_STATUS"; status: JobStatus; progress: number; error?: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

function reducer(state: WorkflowState, action: Action): WorkflowState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SET_UPLOAD":
      return {
        ...state,
        fileId: action.fileId,
        filename: action.filename,
        fileSize: action.fileSize,
        viewerUrn: action.viewerUrn || null,
        error: null,
      };
    case "SET_PARKING_RULES":
      return { ...state, parkingRules: action.rules };
    case "SET_JOB":
      return {
        ...state,
        jobId: action.jobId,
        jobStatus: "pending",
        jobProgress: 0,
        jobError: null,
      };
    case "SET_JOB_STATUS":
      return {
        ...state,
        jobStatus: action.status,
        jobProgress: action.progress,
        jobError: action.error || null,
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };
    case "RESET":
      return INITIAL_STATE;
    default:
      return state;
  }
}

interface WorkflowContextValue {
  state: WorkflowState;
  dispatch: React.Dispatch<Action>;
  goToStep: (step: WorkflowStep) => void;
  canGoToStep: (step: WorkflowStep) => boolean;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

const STEP_ORDER: WorkflowStep[] = ["upload", "configure", "export"];

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const canGoToStep = useCallback(
    (step: WorkflowStep) => {
      const idx = STEP_ORDER.indexOf(step);
      if (idx === 0) return true;
      if (idx >= 1 && !state.fileId) return false;
      if (idx >= 2 && !state.jobId) return false;
      return true;
    },
    [state.fileId, state.jobId]
  );

  const goToStep = useCallback(
    (step: WorkflowStep) => {
      if (canGoToStep(step)) {
        dispatch({ type: "SET_STEP", step });
      }
    },
    [canGoToStep]
  );

  return (
    <WorkflowContext.Provider value={{ state, dispatch, goToStep, canGoToStep }}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const ctx = useContext(WorkflowContext);
  if (!ctx) throw new Error("useWorkflow must be used within WorkflowProvider");
  return ctx;
}
