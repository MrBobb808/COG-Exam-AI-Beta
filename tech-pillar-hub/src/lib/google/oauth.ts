import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  // Teacher-level scope — needed to list all coursework in courses you teach
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.announcements",
  "https://www.googleapis.com/auth/classroom.topics",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/auth/callback"
  );
}

export function generateAuthUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function createAuthenticatedClient(refreshToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export async function getGoogleUserInfo(accessToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const res = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
  return res.data;
}

export async function revokeToken(token: string) {
  const client = createOAuth2Client();
  await client.revokeToken(token);
}

export { SCOPES };
