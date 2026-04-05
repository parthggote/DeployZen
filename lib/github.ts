import logger from "@/lib/logger"

const GITHUB_API = "https://api.github.com"

export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  private: boolean
  html_url: string
  description: string | null
  language: string | null
  default_branch: string
  updated_at: string
  stargazers_count: number
  owner: {
    login: string
    avatar_url: string
  }
}

export interface TreeEntry {
  path: string
  type: "blob" | "tree"
  size?: number
  sha: string
}

export interface FileTreeEntry {
  path: string
  type: "file" | "dir"
  size?: number
  findingCount: number
}

/**
 * Lists repositories accessible to the authenticated user
 * @param {string} token - GitHub OAuth access token
 * @param {number} page - Pagination page number (1-indexed)
 * @returns {Promise<GitHubRepo[]>} Array of repository objects
 */
export async function listUserRepos(token: string, page = 1): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${GITHUB_API}/user/repos?sort=updated&per_page=30&page=${page}&type=all`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  )

  if (!res.ok) {
    logger.error("Failed to list user repos", { status: res.status })
    throw new Error(`GitHub API error: ${res.status}`)
  }

  return res.json()
}

/**
 * Retrieves the latest commit SHA for a given branch
 * @param {string} token - GitHub OAuth access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name (defaults to main)
 * @returns {Promise<string>} The commit SHA string
 */
export async function getLatestCommitSha(
  token: string,
  owner: string,
  repo: string,
  branch = "main"
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/commits/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  )

  if (!res.ok) {
    logger.error("Failed to get latest commit SHA", { owner, repo, branch, status: res.status })
    throw new Error(`GitHub API error: ${res.status}`)
  }

  const data = await res.json()
  return data.sha
}

/**
 * Fetches the full recursive file tree for a repo at a given commit SHA
 * @param {string} token - GitHub OAuth access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} sha - Commit SHA to fetch tree at
 * @returns {Promise<TreeEntry[]>} Flat list of all tree entries
 */
export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<TreeEntry[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  )

  if (!res.ok) {
    logger.error("Failed to get repo tree", { owner, repo, sha, status: res.status })
    throw new Error(`GitHub API error: ${res.status}`)
  }

  const data = await res.json()
  return data.tree || []
}

/**
 * Fetches the decoded text content of a single file at a pinned commit SHA
 * @param {string} token - GitHub OAuth access token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path within the repository
 * @param {string} sha - Commit SHA to fetch content at
 * @returns {Promise<string>} Decoded file content as a UTF-8 string
 */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  sha: string
): Promise<string> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${sha}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    }
  )

  if (!res.ok) {
    logger.error("Failed to get file content", { owner, repo, path, sha, status: res.status })
    throw new Error(`GitHub API error: ${res.status}`)
  }

  const data = await res.json()

  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8")
  }

  return data.content || ""
}

/**
 * Exchanges a temporary OAuth code for an access token
 * @param {string} code - The authorization code from GitHub redirect
 * @returns {Promise<{access_token: string, token_type: string, scope: string}>} Token response
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  token_type: string
  scope: string
}> {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth credentials not configured")
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })

  if (!res.ok) {
    logger.error("Failed to exchange OAuth code", { status: res.status })
    throw new Error("Failed to exchange OAuth code for token")
  }

  const data = await res.json()

  if (data.error) {
    logger.error("GitHub OAuth token error", { error: data.error, description: data.error_description })
    throw new Error(data.error_description || data.error)
  }

  return data
}

/**
 * Fetches the authenticated user's profile from GitHub
 * @param {string} token - GitHub OAuth access token
 * @returns {Promise<{login: string, avatar_url: string, id: number}>} User profile
 */
export async function getAuthenticatedUser(token: string): Promise<{
  login: string
  avatar_url: string
  id: number
}> {
  const res = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  })

  if (!res.ok) {
    logger.error("Failed to get authenticated user", { status: res.status })
    throw new Error(`GitHub API error: ${res.status}`)
  }

  return res.json()
}
