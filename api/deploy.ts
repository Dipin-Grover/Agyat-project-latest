import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getAwsCredentials, getAwsRegion, getDeployQueueUrl, getDeploymentsTable } from "./lib/config.js";

function createClients() {
  const region = getAwsRegion();
  const credentials = getAwsCredentials();
  if (!region || !credentials) return null;

  const clientConfig = { region, credentials };
  return {
    dynamo: DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig)),
    sqs: new SQSClient(clientConfig),
  };
}

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

  const tableName = getDeploymentsTable();
  const queueUrl = getDeployQueueUrl();
  const clients = createClients();

  if (!tableName || !queueUrl || !clients) {
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
    await clients.dynamo.send(new PutCommand({
      TableName: tableName,
      Item: { id, status: "queued", repoUrl, createdAt },
      ConditionExpression: "attribute_not_exists(id)",
    }));

    await clients.sqs.send(new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify({ id, repoUrl }),
    }));

    return res.status(202).json({ id, status: "queued" });
  } catch (error) {
    console.error("Failed to queue deployment", { id, error });
    return res.status(500).json({ error: "Could not queue deployment" });
  }
}
