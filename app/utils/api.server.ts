import { json } from "@remix-run/node";
import { createHash } from "crypto";
import { getStatusCode, type ErrorResponse } from "./errors.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain",
};

export function corsPreflightResponse() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function apiSuccess<T>(data: T, extraHeaders?: Record<string, string>) {
  return json({ success: true, data }, { headers: { ...corsHeaders, ...extraHeaders } });
}

export function apiError(errorResponse: ErrorResponse, extraHeaders?: Record<string, string>) {
  const status = getStatusCode(errorResponse.error.code);
  return json(errorResponse, { status, headers: { ...corsHeaders, ...extraHeaders } });
}

export function getShopDomain(request: Request, url: URL): string | null {
  return request.headers.get("X-Shop-Domain") || url.searchParams.get("shop");
}

export function generateETag(data: unknown): string {
  const hash = createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
  return `"${hash}"`;
}

export function checkETagMatch(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get("If-None-Match");
  return ifNoneMatch === etag;
}

export function notModifiedResponse(etag: string) {
  return new Response(null, {
    status: 304,
    headers: { ...corsHeaders, "ETag": etag },
  });
}
