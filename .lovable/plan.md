

# Highway Accessible Parking Bay Generator

## Overview
A professional engineering web app for generating accessible parking bays from CAD drawings. The frontend handles the full workflow UI and communicates with an external Python backend API for CAD processing.

## Architecture
- **Frontend (Lovable):** React app with engineering workflow UI
- **Backend (External):** Python API you host separately — we define the full API contract
- **Autodesk API:** For DWG↔DXF conversion (credentials stored as secrets)

## Pages & Workflow

### 1. Upload & Configure Page
- Drag-and-drop upload for DWG/DXF files
- File info display (filename, size, detected layers)
- API sends file to Python backend, receives parsed geometry data
- Status indicators for upload → parse → analysis pipeline

### 2. Road Analysis Panel
- SVG/Canvas preview of parsed CAD geometry (polylines, edges, centerlines)
- Auto-detected road edges highlighted with confidence indicators
- User can select/confirm the correct road edge from candidates
- Road direction indicator with left/right side toggle for parking placement
- Manual override: click to select edge polyline if auto-detection is wrong

### 3. Parking Rules Configuration
- **Form inputs** for: width, length, spacing, lateral offset, orientation, clearance, side of road, starting vehicle number
- **Preset buttons** for common standards (2.0×6.0m, 2.5×7.5m)
- **AI natural language input:** Text box where user types rules like "2.5 by 7.5 meters every 20 meters on the right side" — sent to Lovable AI edge function which returns structured parameters that populate the form
- All parameters are always visible and editable regardless of input method

### 4. Preview & Clash Detection Panel
- Canvas rendering of generated parking bays overlaid on road geometry
- Color-coded results: green = valid, red = clash detected, yellow = warning (tight curve)
- Clash detail list showing each conflict (type, location, severity)
- Approve/reject individual bays
- Option to force-approve flagged bays with explicit confirmation

### 5. Export Panel
- Summary of generated bays (count, numbering, placement stats)
- Download button for final DWG file
- Option to also download DXF
- Export validation gate: warns if unresolved clashes exist

## API Contract (for Python backend)
The frontend will call these endpoints — we'll create TypeScript types and API client code:

- `POST /upload` — Upload CAD file, returns parsed geometry + layers
- `POST /analyze-road` — Returns detected edges, centerline, direction candidates
- `POST /generate-parking` — Takes confirmed edge + rules, returns parking bay geometries
- `POST /detect-clashes` — Validates generated bays against existing entities
- `POST /export` — Generates final DWG file for download

## AI Edge Function
- Single Supabase edge function for natural language rule parsing
- Input: user's text instruction → Output: structured parking parameters JSON
- Uses Lovable AI gateway with tool calling for structured extraction

## UI Design
- Clean, professional engineering interface — minimal chrome, data-dense
- Dark sidebar navigation for workflow steps (Upload → Analyze → Configure → Preview → Export)
- Step-by-step wizard flow with ability to go back
- Responsive but optimized for desktop (engineers use large screens)

## MVP Scope (Phase 1)
- Full UI workflow with all 5 panels
- API client with TypeScript types for all endpoints
- AI rule parsing edge function
- Canvas-based geometry preview (renders polylines + rectangles from API data)
- Mock/demo mode that works without backend connected (sample geometry data)
- Configurable backend URL setting

