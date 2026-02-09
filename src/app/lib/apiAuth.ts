import { NextResponse } from "next/server";

type ApiAuthResult =
  | { ok: true }
  | { ok: false; response: NextResponse };

function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    if (authHeader.toLowerCase().startsWith("bearer ")) {
      return authHeader.slice(7).trim();
    }
    return authHeader.trim();
  }
  const apiKey = request.headers.get("x-api-key");
  return apiKey ? apiKey.trim() : null;
}

export function requireApiKey(
  request: Request,
  envKey: string,
): ApiAuthResult {
  const expected = process.env[envKey];
  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "API secret is not configured." },
          { status: 500 },
        ),
      };
    }
    return { ok: true };
  }

  const token = getTokenFromRequest(request);
  if (!token || token !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 },
      ),
    };
  }

  return { ok: true };
}

