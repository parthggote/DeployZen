# Semgrep Worker Service

Lightweight Docker service that runs Semgrep security scans on GitHub repositories.

## Deploying to Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New** > **Web Service**
3. Connect the DeployZen repository
4. Set **Root Directory** to `semgrep-worker`
5. Render will auto-detect the Dockerfile
6. Choose the **Free** plan
7. Set environment variable: `PORT=4000`
8. Deploy

Once deployed, copy the service URL and set it as `SEMGREP_WORKER_URL` in the Next.js app's `.env.local`.

## Local Development

```bash
cd semgrep-worker
npm install
node server.js
```

The worker will start on port 4000.

## API

### `GET /health`
Returns `{ status: "ok" }`.

### `POST /scan`
Clones a repo, runs Semgrep, returns findings and file tree.

**Body:**
```json
{
  "repoFullName": "owner/repo",
  "accessToken": "ghp_xxx",
  "commitSha": "abc123"
}
```

**Response:**
```json
{
  "success": true,
  "commitSha": "abc123",
  "findings": [...],
  "fileTree": [...],
  "stats": { "total": 5, "critical": 1, "warning": 3, "info": 1, "filesScanned": 42 }
}
```
