

# Fix "Failed to fetch" on DWG Upload

## Problem
The app is calling `http://localhost:3001/upload` because `VITE_API_URL` is not set. The Lovable preview cannot reach localhost — it needs the real backend URL.

## Steps

1. **Set environment variable** `VITE_API_URL=https://api.kareemsamman.com` using the Lovable secrets manager.

2. **Update `src/lib/api-client.ts`** — Ensure the fallback URL also points to the correct backend (in case the env var isn't picked up during build):
   - Keep the env var as primary, but log the resolved URL to console in dev for debugging.

3. **Accept DXF files too** — The upload step currently only accepts `.dwg`. Since the system supports DXF as well, update the file validation to accept both `.dwg` and `.dxf`.

4. **Add error detail** — Improve the catch block to show the actual URL being called when fetch fails, so connection issues are easier to diagnose.

## Technical Details

- The `VITE_API_URL` env var must be set via Lovable's secrets/environment panel (not just `.env` file) so it's available in the preview build.
- The network logs confirm all 3 upload attempts hit `http://localhost:3001/upload` and failed.
- No code logic bug — purely a configuration issue causing the fetch to fail against an unreachable host.

