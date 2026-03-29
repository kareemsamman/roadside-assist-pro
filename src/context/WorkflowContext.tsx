import React, { createContext, useContext, useReducer, useCallback } from "react";
import type {
  WorkflowState,
  WorkflowStep,
  UploadResponse,
  AnalyzeRoadResponse,
  ParkingRules,
  ParkingBay,
  ClashResult,
} from "@/types/cad";
import { DEFAULT_PARKING_RULES } from "@/types/cad";

const INITIAL_STATE: WorkflowState = {
  currentStep: "upload",
  uploadData: null,
  roadAnalysis: null,
  selectedEdgeId: null,
  parkingSide: "right",
  parkingRules: DEFAULT_PARKING_RULES,
  generatedBays: [],
  clashResults: [],
  approvedBayIds: new Set(),
  isLoading: false,
  error: null,
};

type Action =
  | { type: "SET_STEP"; step: WorkflowStep }
  | { type: "SET_UPLOAD"; data: UploadResponse }
  | { type: "SET_ROAD_ANALYSIS"; data: AnalyzeRoadResponse }
  | { type: "SET_SELECTED_EDGE"; edgeId: string }
  | { type: "SET_PARKING_SIDE"; side: "left" | "right" }
  | { type: "SET_PARKING_RULES"; rules: ParkingRules }
  | { type: "SET_GENERATED_BAYS"; bays: ParkingBay[] }
  | { type: "SET_CLASH_RESULTS"; clashes: ClashResult[] }
  | { type: "TOGGLE_BAY_APPROVAL"; bayId: string }
  | { type: "APPROVE_ALL_VALID" }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

function reducer(state: WorkflowState, action: Action): WorkflowState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };
    case "SET_UPLOAD":
      return { ...state, uploadData: action.data, error: null };
    case "SET_ROAD_ANALYSIS":
      return { ...state, roadAnalysis: action.data, error: null };
    case "SET_SELECTED_EDGE":
      return { ...state, selectedEdgeId: action.edgeId };
    case "SET_PARKING_SIDE":
      return { ...state, parkingSide: action.side, parkingRules: { ...state.parkingRules, side: action.side } };
    case "SET_PARKING_RULES":
      return { ...state, parkingRules: action.rules };
    case "SET_GENERATED_BAYS":
      return { ...state, generatedBays: action.bays, approvedBayIds: new Set(action.bays.map((b) => b.id)) };
    case "SET_CLASH_RESULTS": {
      const errorIds = new Set(action.clashes.filter((c) => c.severity === "error").map((c) => c.bayId));
      const approved = new Set(state.generatedBays.filter((b) => !errorIds.has(b.id)).map((b) => b.id));
      return { ...state, clashResults: action.clashes, approvedBayIds: approved };
    }
    case "TOGGLE_BAY_APPROVAL": {
      const next = new Set(state.approvedBayIds);
      if (next.has(action.bayId)) next.delete(action.bayId);
      else next.add(action.bayId);
      return { ...state, approvedBayIds: next };
    }
    case "APPROVE_ALL_VALID": {
      const errorIds = new Set(state.clashResults.filter((c) => c.severity === "error").map((c) => c.bayId));
      const approved = new Set(state.generatedBays.filter((b) => !errorIds.has(b.id)).map((b) => b.id));
      return { ...state, approvedBayIds: approved };
    }
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

const STEP_ORDER: WorkflowStep[] = ["upload", "analyze", "configure", "preview", "export"];

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const canGoToStep = useCallback(
    (step: WorkflowStep) => {
      const idx = STEP_ORDER.indexOf(step);
      if (idx === 0) return true;
      if (idx >= 1 && !state.uploadData) return false;
      if (idx >= 2 && !state.roadAnalysis) return false;
      if (idx >= 3 && !state.selectedEdgeId) return false;
      if (idx >= 4 && state.generatedBays.length === 0) return false;
      return true;
    },
    [state.uploadData, state.roadAnalysis, state.selectedEdgeId, state.generatedBays]
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
