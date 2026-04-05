import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { listUserRepos } from "@/lib/github"
import logger from "@/lib/logger"

/**
 * Lists GitHub repositories for the connected user
 * @param {NextRequest} req - Request with ?page= query param
 * @returns {NextResponse} JSON array of repositories
 */
export async function GET(req: NextRequest) {
  try {
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10)

    const client = await clientPromise
    const db = client.db("DeployZen")

    const user = await db.collection("users").findOne(
      {},
      { sort: { connectedAt: -1 } }
    )

    if (!user?.githubAccessToken) {
      return NextResponse.json(
        { success: false, error: "GitHub not connected" },
        { status: 401 }
      )
    }

    const repos = await listUserRepos(user.githubAccessToken, page)

    return NextResponse.json({
      success: true,
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        description: r.description,
        language: r.language,
        defaultBranch: r.default_branch,
        updatedAt: r.updated_at,
        stars: r.stargazers_count,
        owner: r.owner.login,
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Failed to list repos", { error: message })
    return NextResponse.json(
      { success: false, error: "Failed to list repositories" },
      { status: 500 }
    )
  }
}
