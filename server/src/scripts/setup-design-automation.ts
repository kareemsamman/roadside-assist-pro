/**
 * One-time setup script for Autodesk Design Automation.
 * Creates both activities needed for the 2-phase pipeline:
 *   1. ExtractGeometry — reads polylines from the DWG into JSON
 *   2. ParkingBayGenerator — draws computed parking bays into the DWG
 *
 * Usage: npm run setup-da
 */
import "../config.js";
import {
  createExtractActivity,
  createGenerateActivity,
  getNickname,
} from "../services/aps-da.js";

const EXTRACT_ACTIVITY = "ExtractGeometry";
const GENERATE_ACTIVITY = "ParkingBayGenerator";

async function main() {
  const nickname = await getNickname();
  console.log(`[Setup] APS nickname: ${nickname}`);

  // Activity 1: Extract geometry
  console.log(`[Setup] Creating extract activity: ${EXTRACT_ACTIVITY}...`);
  await createExtractActivity(
    EXTRACT_ACTIVITY,
    "Extract LWPOLYLINE geometry from a DWG file to JSON"
  );
  const extractId = `${nickname}.${EXTRACT_ACTIVITY}+prod`;
  console.log(`[Setup] Extract activity ready: ${extractId}`);

  // Activity 2: Generate parking bays
  console.log(`[Setup] Creating generate activity: ${GENERATE_ACTIVITY}...`);
  await createGenerateActivity(
    GENERATE_ACTIVITY,
    "Draw accessible parking bays onto a DWG highway drawing"
  );
  const generateId = `${nickname}.${GENERATE_ACTIVITY}+prod`;
  console.log(`[Setup] Generate activity ready: ${generateId}`);

  // Print env config
  console.log("");
  console.log("[Setup] Add these to your .env file:");
  console.log(`  APS_EXTRACT_ACTIVITY_ID=${extractId}`);
  console.log(`  APS_GENERATE_ACTIVITY_ID=${generateId}`);
}

main().catch((err) => {
  console.error("[Setup] Failed:", err.message);
  if (err.response?.data) {
    console.error(
      "[Setup] Response:",
      JSON.stringify(err.response.data, null, 2)
    );
  }
  process.exit(1);
});
