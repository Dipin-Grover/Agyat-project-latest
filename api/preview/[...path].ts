import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAwsCredentials, getAwsRegion, getBucketName } from "../lib/config.js";

function getContentType(filePath: string): string {
  if (filePath.endsWith(".html")) return "text/html";
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
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const s3 = createS3();
  if (!s3) {
    return res.status(500).json({ error: "Preview service is not configured" });
  }

  const pathArray = req.query.path as string[];
  if (!pathArray || pathArray.length === 0) {
    return res.status(400).send("Missing preview ID");
  }

  const id = pathArray[0];
  let filePath = "/" + pathArray.slice(1).join("/");
  if (filePath === "/" || filePath === "") {
    filePath = "/index.html";
  }

  const primaryKey = `dist/${id}${filePath}`;
  const primaryBody = await fetchObject(s3.client, s3.bucket, primaryKey);
  if (primaryBody) {
    res.setHeader("Content-Type", getContentType(filePath));
    return res.send(Buffer.from(primaryBody));
  }

  const fallbacks = [
    `dist/${id}/index.html`,
    `dist/${id}/src/index.html`,
    `dist/${id}/public/index.html`,
  ];

  for (const key of fallbacks) {
    const body = await fetchObject(s3.client, s3.bucket, key);
    if (body) {
      res.setHeader("Content-Type", "text/html");
      return res.send(Buffer.from(body));
    }
  }

  return res.status(404).send("File not found");
}
