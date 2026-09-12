import type { AwsCredentialIdentity } from "@aws-sdk/types";

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function getAwsRegion(): string | undefined {
  return firstEnv("AWS_REGION");
}

export function getAwsCredentials(): AwsCredentialIdentity | undefined {
  const accessKeyId = firstEnv("AWS_ACCESS_KEY_ID");
  const secretAccessKey = firstEnv("AWS_SECRET_ACCESS_KEY");
  if (!accessKeyId || !secretAccessKey) return undefined;
  return { accessKeyId, secretAccessKey };
}

export function getDeploymentsTable(): string | undefined {
  return firstEnv("AWS_DEPLOYMENTS_TABLE", "AWS_DYNAMO_DB_NAME");
}

export function getDeployQueueUrl(): string | undefined {
  return firstEnv("AWS_DEPLOY_QUEUE_URL", "AWS_SQS_QUEUE_URL");
}

export function getBucketName(): string | undefined {
  return firstEnv("AWS_BUCKET_NAME");
}
