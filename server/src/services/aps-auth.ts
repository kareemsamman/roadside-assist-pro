import axios from "axios";
import { config } from "../config.js";

const APS_AUTH_URL = "https://developer.api.autodesk.com/authentication/v2/token";

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Obtain a 2-legged OAuth token from Autodesk Platform Services.
 * Tokens are cached and refreshed 60 seconds before expiry.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    scope: [
      "data:read",
      "data:write",
      "data:create",
      "bucket:read",
      "bucket:create",
      "code:all",
    ].join(" "),
  });

  const response = await axios.post<TokenResponse>(APS_AUTH_URL, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    auth: {
      username: config.aps.clientId,
      password: config.aps.clientSecret,
    },
  });

  cachedToken = response.data.access_token;
  // Refresh 60 seconds before actual expiry
  tokenExpiry = now + (response.data.expires_in - 60) * 1000;

  return cachedToken;
}
