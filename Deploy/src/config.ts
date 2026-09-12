function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function requireEnv(label: string, ...names: string[]): string {
  const value = firstEnv(...names);
  if (!value) {
    throw new Error(`Missing required environment variable (${label}). Expected one of: ${names.join(", ")}`);
  }
  return value;
}

export function getDeploymentsTable(): string {
  return requireEnv("deployments table", "AWS_DEPLOYMENTS_TABLE", "AWS_DYNAMO_DB_NAME");
}

export function getDeployQueueUrl(): string {
  return requireEnv("deploy queue", "AWS_DEPLOY_QUEUE_URL", "AWS_SQS_QUEUE_URL");
}

export function validateWorkerEnv(): void {
  requireEnv("AWS region", "AWS_REGION");
  requireEnv("AWS access key", "AWS_ACCESS_KEY_ID");
  requireEnv("AWS secret key", "AWS_SECRET_ACCESS_KEY");
  requireEnv("S3 bucket", "AWS_BUCKET_NAME");
  getDeploymentsTable();
  getDeployQueueUrl();
}
