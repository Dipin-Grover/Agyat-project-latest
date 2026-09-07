import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION }),
);
const sqs = new SQSClient({ region: process.env.AWS_REGION });

const tableName = process.env.AWS_DEPLOYMENTS_TABLE || process.env.AWS_DYNAMO_DB_NAME;
const queueUrl = process.env.AWS_DEPLOY_QUEUE_URL || process.env.AWS_SQS_QUEUE_URL;

function isAllowedRepository(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "github.com" &&
      url.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!tableName || !queueUrl) {
    return res.status(500).json({ error: "Deployment service is not configured" });
  }

  const repoUrl = req.body?.repoUrl;
  if (!isAllowedRepository(repoUrl)) {
    return res.status(400).json({
      error: "repoUrl must be a public GitHub HTTPS repository URL",
    });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  try {
    await dynamo.send(new PutCommand({
      TableName: tableName,
      Item: { id, status: "queued", repoUrl, createdAt },
      ConditionExpression: "attribute_not_exists(id)",
    }));

    await sqs.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ id, repoUrl }),
    }));

    return res.status(202).json({ id, status: "queued" });
  } catch (error) {
    console.error("Failed to queue deployment", { id, error });
    return res.status(500).json({ error: "Could not queue deployment" });
  }
}
