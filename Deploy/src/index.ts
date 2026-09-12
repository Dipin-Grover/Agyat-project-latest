import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import dotenv from "dotenv";
import { copyFinalDist } from "./aws";
import { buildProject } from "./build";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { getDeployQueueUrl, getDeploymentsTable, validateWorkerEnv } from "./config";
import simpleGit from "simple-git";
import fs from "fs/promises";
import path from "path";

dotenv.config();

try {
    validateWorkerEnv();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION! });
const tableName = getDeploymentsTable();
const sqs = new SQSClient({ region: process.env.AWS_REGION! });
const queueUrl = getDeployQueueUrl();

async function deleteMessage(receiptHandle: string) {
    await sqs.send(new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
    }));
}

async function main() {
    console.log("Worker started. Listening for messages...");
    console.log(`Queue: ${queueUrl}`);
    console.log(`Table: ${tableName}`);

    while (true) {
        console.log("Polling SQS...");
        const result = await sqs.send(new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
        }));

        const message = result.Messages?.[0];
        if (!message?.ReceiptHandle) continue;

        const receiptHandle = message.ReceiptHandle;
        console.log("Received a message from SQS!");
        console.log("Message body:", message.Body);

        let job: { id?: string; repoUrl?: string };
        try {
            job = JSON.parse(message.Body || "{}");
        } catch {
            console.error("Discarding malformed deployment message");
            await deleteMessage(receiptHandle);
            continue;
        }

        const id = job.id || "";
        const repoUrl = job.repoUrl || "";
        if (!id || !repoUrl) {
            console.error("Discarding deployment message with missing id or repoUrl");
            await deleteMessage(receiptHandle);
            continue;
        }

        const targetDir = path.join(__dirname, `output/${id}`);
        try {
            await updateStatus(id, "building");
            await removeBuildDirectory(targetDir);
            await simpleGit().clone(repoUrl, targetDir, ["--depth", "1"]);
            await buildProject(id);
            await copyFinalDist(id);
            await updateStatus(id, "deployed", undefined, buildPreviewUrl(id));
            console.log(`Deployment ${id} completed`);
        } catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            console.error("Build failed:", messageText);
            await updateStatus(id, "failed", messageText);
        } finally {
            await deleteMessage(receiptHandle);
        }
    }
}

async function removeBuildDirectory(targetDir: string) {
    try {
        await fs.rm(targetDir, {
            recursive: true,
            force: true,
            maxRetries: 8,
            retryDelay: 1000,
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
    const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}/api/preview/${id}`;
}

async function updateStatus(id: string, status: string, error?: string, previewUrl?: string) {
    const values: Record<string, { S: string }> = {
        ":status": { S: status },
        ":updatedAt": { S: new Date().toISOString() },
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
        ExpressionAttributeValues: values,
    }));
}

main();
