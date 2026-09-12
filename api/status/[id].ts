import type { VercelRequest, VercelResponse } from "@vercel/node";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getAwsCredentials, getAwsRegion, getDeploymentsTable } from "../lib/config.js";

function createDynamo() {
  const region = getAwsRegion();
  const credentials = getAwsCredentials();
  if (!region || !credentials) return null;

  return DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  const tableName = getDeploymentsTable();
  const dynamo = createDynamo();

  if (!id || !tableName || !dynamo) {
    return res.status(400).json({ error: "Invalid deployment request" });
  }

  try {
    const result = await dynamo.send(new GetCommand({
      TableName: tableName,
      Key: { id },
      ProjectionExpression: "id, #status, repoUrl, createdAt, updatedAt, #error, previewUrl",
      ExpressionAttributeNames: { "#status": "status", "#error": "error" },
    }));

    if (!result.Item) return res.status(404).json({ error: "Deployment not found" });
    return res.status(200).json(result.Item);
  } catch (error) {
    console.error("Failed to fetch deployment status", { id, error });
    return res.status(500).json({ error: "Could not fetch deployment status" });
  }
}
