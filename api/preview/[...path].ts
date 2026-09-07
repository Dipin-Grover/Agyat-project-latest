import type { VercelRequest, VercelResponse } from "@vercel/node";
import { S3 } from "aws-sdk";

const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const pathArray = req.query.path as string[];
    if (!pathArray || pathArray.length === 0) {
        return res.status(400).send("Missing preview ID");
    }

    const id = pathArray[0];
    // Reconstruct the file path from the rest of the array
    let filePath = "/" + pathArray.slice(1).join("/");

    if (filePath === "/" || filePath === "") {
        filePath = "/index.html";
    }

    try {
        const contents = await s3.getObject({
            Bucket: process.env.AWS_BUCKET_NAME!,
            Key: `dist/${id}${filePath}`
        }).promise();

        res.setHeader("Content-Type", getContentType(filePath));
        return res.send(contents.Body);
    } catch (error) {
        const fallbacks = [
            `dist/${id}/index.html`,
            `dist/${id}/src/index.html`,
            `dist/${id}/public/index.html`
        ];
        let served = false;
        for (const key of fallbacks) {
            try {
                const fallbackContents = await s3.getObject({
                    Bucket: process.env.AWS_BUCKET_NAME!,
                    Key: key
                }).promise();

                res.setHeader("Content-Type", "text/html");
                res.send(fallbackContents.Body);
                served = true;
                break;
            } catch (err) {
                // continue to next fallback
            }
        }
        if (!served) {
            return res.status(404).send("File not found");
        }
    }
}
