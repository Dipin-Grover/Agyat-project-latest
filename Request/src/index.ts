import express from "express";
import { S3 } from "aws-sdk";
import dotenv from 'dotenv';
dotenv.config();

const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    region: process.env.AWS_REGION!
});

const app = express();

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

app.get("/*", async (req, res) => {
    const host = req.hostname;
    const id = host.split(".")[0];
    let filePath = req.path;

    if (filePath === "/" || filePath === "") {
        filePath = "/index.html";
    }

    try {
        const contents = await s3.getObject({
            Bucket: process.env.AWS_BUCKET_NAME!,
            Key: `dist/${id}${filePath}`
        }).promise();

        res.set("Content-Type", getContentType(filePath));
        res.send(contents.Body);
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

                res.set("Content-Type", "text/html");
                res.send(fallbackContents.Body);
                served = true;
                break;
            } catch (err) {
                // continue to next fallback
            }
        }
        if (!served) {
            res.status(404).send("File not found");
        }
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Request server listening on port ${port}`);
});