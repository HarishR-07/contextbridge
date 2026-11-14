import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";

// Per server instance (best effort on serverless). Counts every request, including failed access attempts.
const hits = new Map<string, number[]>();
const sha = (s: string) => createHash("sha256").update(s).digest();

export function guard(req: Request): void {
  const env = process.env;
  const h = req.headers;
  const ip = h.get("x-real-ip") || h.get("x-vercel-forwarded-for")?.split(",")[0].trim() || h.get("x-forwarded-for")?.split(",")[0].trim() || "local";

  // 1. Rate limit first, so guessing the access code is throttled too.
  const limit = Number(env.RATE_LIMIT_PER_MIN) || 20;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= limit) throw new AppError(429, "Too many requests. Wait a minute and try again.");
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  // 2. Same-origin JSON only: blocks other websites from spending your AI credits through a visitor's browser.
  const origin = h.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (originHost !== h.get("host")) throw new AppError(403, "Cross-origin requests are not allowed.");
  }
  if (!(h.get("content-type") || "").toLowerCase().startsWith("application/json")) throw new AppError(415, "Content-Type must be application/json.");

  // 3. Access code (constant-time compare). In production the app refuses to run open unless you opt in.
  const code = env.ACCESS_CODE;
  if (!code && env.NODE_ENV === "production" && env.ALLOW_PUBLIC !== "true")
    throw new AppError(503, "Server is not configured. Set ACCESS_CODE (or ALLOW_PUBLIC=true to run without one).");
  if (code && env.NODE_ENV === "production" && code.length < 20)
    throw new AppError(503, "ACCESS_CODE must be at least 20 characters in production.");
  if (code && !timingSafeEqual(sha(h.get("x-access-code") ?? ""), sha(code))) throw new AppError(401, "Access code is required or incorrect.");
}

/** Reads a JSON body with a hard size cap. Returns null if the body is not valid JSON. */
export async function readJson(req: Request, max = 1_500_000): Promise<any> {
  if (Number(req.headers.get("content-length") ?? 0) > max) throw new AppError(413, "Request is too large.");
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new AppError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}
