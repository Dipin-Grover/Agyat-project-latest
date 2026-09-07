# Agyat

Agyat is a small deployment platform prototype. It accepts a public GitHub repository, queues a build, publishes the generated site to S3, and exposes deployment status through an API.

## Architecture

- `public/` and `api/`: Vercel dashboard and serverless API
- `Deploy/`: long-running SQS worker; deploy this separately on Railway, Render, or Fly.io
- AWS S3: stores source artifacts and published files
- AWS SQS: decouples requests from builds
- DynamoDB: stores deployment status

Vercel should host the root project only. It cannot host the continuous SQS worker.

## Go live checklist

### 1. AWS (one-time)

Create these in the [AWS Console](https://console.aws.amazon.com/) (region e.g. `ap-south-1`):

| Resource | Settings |
|----------|----------|
| **S3 bucket** | Any name, block public access (Vercel reads via API) |
| **DynamoDB table** | Name: `agyat-deployments`, partition key: `id` (String) |
| **SQS queue** | Standard queue, name: `agyat-deployments` |
| **IAM user** | Programmatic access; attach policies for S3, DynamoDB, SQS on those resources |

Copy the IAM access key, secret, bucket name, table name, and queue URL.

### 2. Push code to GitHub

Commit and push all changes so Vercel can deploy the latest API and dashboard.

### 3. Vercel (dashboard + API)

1. Sign in at [vercel.com](https://vercel.com) and import `Dipin-Grover/Agyat-project-latest`.
2. Keep the project root at the repository root.
3. Add environment variables from `.env.example` (except `PREVIEW_BASE_URL` — worker only).
4. Deploy and note your URL, e.g. `https://agyat-xxx.vercel.app`.

### 4. Railway (build worker)

1. Sign in at [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. Set the service root directory to **`Deploy/`**.
3. Add the same AWS variables as Vercel, plus:
   - `PREVIEW_BASE_URL=https://your-vercel-url.vercel.app` (no trailing slash)
4. Deploy. The worker must stay running to poll SQS.

`Deploy/railway.toml` is included for Docker-based deploys on Railway.

### 5. Demo test

1. Open your Vercel URL.
2. Paste a public GitHub repo with a `build` script (e.g. a small Vite or Create React App project).
3. Wait for status: `queued` → `building` → `deployed`.
4. Click **View your website** when the preview link appears.

## Vercel setup

1. Rotate any AWS keys that have ever been placed in local `.env` files.
2. Create an S3 bucket, DynamoDB table with `id` as the partition key, and an SQS queue.
3. Import this repository into Vercel with the repository root as the project root.
4. Add the variables from `.env.example` to Vercel. Use IAM credentials or a Vercel integration, never committed `.env` files.
5. Deploy the `Deploy` worker separately with the same region, bucket, table, and queue settings.
6. Test the home page with a small public repository that has a `build` script.

## Local development

```powershell
npm install
npm run build
```

The root app can be previewed with `vercel dev` after installing the Vercel CLI. The worker still requires Docker or a Linux host with Git and Node.js.

## Current scope

This showcase intentionally accepts public GitHub HTTPS repositories only. Authentication, multi-tenant ownership, private repositories, sandboxed builds, quotas, and production-grade isolation should be added before accepting untrusted users.
