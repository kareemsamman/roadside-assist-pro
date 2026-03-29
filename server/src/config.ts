import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  aps: {
    clientId: required("APS_CLIENT_ID"),
    clientSecret: required("APS_CLIENT_SECRET"),
    bucketKey: process.env.APS_BUCKET_KEY || "roadside-assist-pro",
    extractActivityId: process.env.APS_EXTRACT_ACTIVITY_ID || "",
    generateActivityId: process.env.APS_GENERATE_ACTIVITY_ID || "",
  },
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:8080",
  },
} as const;
