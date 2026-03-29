/**
 * One-time setup script for Autodesk Design Automation.
 * Creates the Activity that runs the AutoCAD engine with parking scripts.
 *
 * Usage: npm run setup-da
 */
import "../config.js"; // validate env vars
import { createActivity, getNickname } from "../services/aps-da.js";

const ACTIVITY_ID = "ParkingBayGenerator";

async function main() {
  console.log("[Setup] Creating Design Automation activity...");

  const nickname = await getNickname();
  console.log(`[Setup] APS nickname: ${nickname}`);

  await createActivity(
    ACTIVITY_ID,
    "Generate accessible parking bays on a DWG highway drawing"
  );

  const fullId = `${nickname}.${ACTIVITY_ID}+prod`;
  console.log(`[Setup] Activity created: ${fullId}`);
  console.log(`[Setup] Add this to your .env file:`);
  console.log(`  APS_ACTIVITY_ID=${fullId}`);
}

main().catch((err) => {
  console.error("[Setup] Failed:", err.message);
  if (err.response?.data) {
    console.error("[Setup] Response:", JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
