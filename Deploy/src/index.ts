import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import { copyFinalDist } from "./aws";
import { buildProject } from "./build";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient} from "@aws-sdk/lib-dynamodb";
import { UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import simpleGit from "simple-git";
import fs from "fs/promises";
import path from "path";
dotenv.config();
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION! });
const docClient = DynamoDBDocumentClient.from(dynamo);

const tableName = process.env.AWS_DEPLOYMENTS_TABLE || process.env.AWS_DYNAMO_DB_NAME!;

const sqs = new SQSClient({ region: process.env.AWS_REGION! });
const queueUrl = process.env.AWS_DEPLOY_QUEUE_URL || process.env.AWS_SQS_QUEUE_URL!;

async function main() {
    console.log("Worker started. Listening for messages...");
    while (true) { 
        console.log("Polling SQS...");
        const result = await sqs.send(new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20
        }));

        if (result.Messages?.[0]) {
            console.log("Received a message from SQS!");
            const message = result.Messages[0];
            console.log("Message body:", message.Body);
            let job: { id?: string; repoUrl?: string };
            try {
                job = JSON.parse(message.Body || "{}");
            } catch {
                console.error("Discarding malformed deployment message");
                await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle! }));
                continue;
            }
            const id = job.id || "";
            if (!id || !job.repoUrl) continue;
            const targetDir = path.join(__dirname, `output/${id}`);
            try {
                await updateStatus(id, "building");
                await removeBuildDirectory(targetDir);
                await simpleGit().clone(job.repoUrl, targetDir, ["--depth", "1"]);
                const result = await buildProject(id || "");
                console.log("Build successful:", result);
                await copyFinalDist(id || "");
                await updateStatus(id, "deployed", undefined, buildPreviewUrl(id));
                await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle! }));
            } catch (error) {
                if (error instanceof Error) {
                    console.error("Build failed:", error.message);
                } else {
                    console.error("Build failed:", String(error));
                }
                await updateStatus(id, "failed", error instanceof Error ? error.message : String(error));
            }
        }
    }
}

async function removeBuildDirectory(targetDir: string) {
    try {
        await fs.rm(targetDir, {
            recursive: true,
            force: true,
            maxRetries: 8,
            retryDelay: 1000
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EBUSY" && (error as NodeJS.ErrnoException).code !== "EPERM") {
            throw error;
        }
        throw new Error(`Build directory is locked: ${targetDir}. Stop duplicate workers and retry.`);
    }
}

function buildPreviewUrl(id: string) {
    const baseUrl = process.env.PREVIEW_BASE_URL || "http://localhost:3000";
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}/api/preview/${id}/`;
}

async function updateStatus(id: string, status: string, error?: string, previewUrl?: string) {
    const values: Record<string, { S: string }> = {
        ":status": { S: status },
        ":updatedAt": { S: new Date().toISOString() }
    };
    const names: Record<string, string> = { "#status": "status" };
    let updateExpression = "SET #status = :status, updatedAt = :updatedAt";
    if (error) {
        updateExpression += ", #error = :error";
        names["#error"] = "error";
        values[":error"] = { S: error.slice(0, 2000) };
    }
    if (previewUrl) {
        updateExpression += ", previewUrl = :previewUrl";
        values[":previewUrl"] = { S: previewUrl };
    }
    await dynamo.send(new UpdateItemCommand({
        TableName: tableName,
        Key: { id: { S: id } },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
    }));
}

main();