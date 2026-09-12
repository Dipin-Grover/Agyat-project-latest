import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAwsCredentials, getAwsRegion, getBucketName } from "./lib/config.js";

function getContentType(filePath: string): string {
  if (filePath.endsWith(".html") || filePath.endsWith(".htm")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css";
  if (filePath.endsWith(".js")) return "application/javascript";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".ico")) return "image/x-icon";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  if (filePath.endsWith(".woff")) return "font/woff";
  if (filePath.endsWith(".ttf")) return "font/ttf";
  return "application/octet-stream";
}

function createS3() {
  const region = getAwsRegion();
  const credentials = getAwsCredentials();
  const bucket = getBucketName();
  if (!region || !credentials || !bucket) return null;

  return {
    bucket,
    client: new S3Client({ region, credentials }),
  };
}

function parsePreviewPath(req: VercelRequest): string[] {
  const rawPath = req.query.path;
  if (Array.isArray(rawPath)) {
    return rawPath.flatMap((part) => String(part).split("/")).filter(Boolean);
  }
  if (typeof rawPath === "string" && rawPath.length > 0) {
    return rawPath.split("/").filter(Boolean);
  }

  const host = req.headers.host || "localhost";
  const pathname = new URL(req.url || "/", `https://${host}`).pathname;
  const prefix = "/api/preview/";
  if (pathname.startsWith(prefix)) {
    return pathname.slice(prefix.length).split("/").filter(Boolean);
  }
  return [];
}

function withPreviewBase(html: string, id: string): string {
  const baseTag = `<base href="/api/preview/${id}/">`;
  if (/<base\s/i.test(html)) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${baseTag}`);
  }
  return `${baseTag}${html}`;
}

async function fetchObject(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<Uint8Array | null> {
  try {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!result.Body) return null;
    return result.Body.transformToByteArray();
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const s3 = createS3();
  if (!s3) {
    return res.status(500).json({ error: "Preview service is not configured" });
  }

  const pathArray = parsePreviewPath(req);
  if (pathArray.length === 0) {
    return res.status(400).send("Missing preview ID");
  }

  const id = pathArray[0];
  let filePath = "/" + pathArray.slice(1).join("/");
  if (filePath === "/" || filePath === "") {
    filePath = "/index.html";
  }

  const keysToTry = [
    `dist/${id}${filePath}`,
    `dist/${id}/index.html`,
    `dist/${id}/src/index.html`,
    `dist/${id}/public/index.html`,
  ];

  for (const key of keysToTry) {
    const body = await fetchObject(s3.client, s3.bucket, key);
    if (!body) continue;

    const isFallbackHtml = key.endsWith(".html") && key !== `dist/${id}${filePath}`;
    const contentType = isFallbackHtml ? "text/html; charset=utf-8" : getContentType(filePath);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=60");

    if (contentType.startsWith("text/html")) {
      return res.send(withPreviewBase(Buffer.from(body).toString("utf8"), id));
    }
    return res.send(Buffer.from(body));
  }

  return res.status(404).send("File not found");
}
