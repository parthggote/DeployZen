import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import logger from "@/lib/logger"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

/**
 * Sends a chat message to Gemini with scan context
 * @param {string} userMessage - The user's message
 * @param {object} scanContext - Summary and optional finding context
 * @param {Array} history - Previous chat messages
 * @returns {Promise<string>} AI response
 */
async function chatWithAI(
  userMessage: string,
  scanContext: {
    repoFullName: string
    summary: Record<string, unknown> | null
    finding?: Record<string, unknown>
  },
  history: Array<{ role: string; content: string }>
): Promise<string> {
  if (!GEMINI_API_KEY) return "AI chat unavailable (GEMINI_API_KEY not configured)."

  const systemContext = `You are a security expert assistant for DeployZen, a code security scanning platform.
You are helping the user understand scan results for the repository: ${scanContext.repoFullName}.

Scan Summary: ${JSON.stringify(scanContext.summary || {})}
${scanContext.finding ? `\nThe user is asking about this specific finding:\n${JSON.stringify(scanContext.finding)}` : ""}

Be concise, actionable, and specific. When suggesting fixes, provide concrete code examples.
Keep responses under 400 words unless the user asks for detail.`

  const conversationParts = [
    { text: systemContext },
    ...history.slice(-10).map((m) => ({ text: `${m.role === "user" ? "User" : "Assistant"}: ${m.content}` })),
    { text: `User: ${userMessage}` },
  ]

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: conversationParts }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    })

    if (!response.ok) {
      logger.error("Gemini chat API request failed", { status: response.status })
      return "AI chat failed (API request error)."
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated."
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Error in AI chat", { error: message })
    return `AI chat failed: ${message}`
  }
}

/**
 * POST — Send a chat message about the scan findings
 * @param {NextRequest} req - Request body: { message, findingIndex? }
 * @param {object} context - Route params containing scan ID
 * @returns {NextResponse} AI response and updated chat history
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { message, findingIndex } = await req.json()

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid scan ID" },
        { status: 400 }
      )
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "message is required" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const scan = await db.collection("scans").findOne({ _id: new ObjectId(id) })

    if (!scan) {
      return NextResponse.json(
        { success: false, error: "Scan not found" },
        { status: 404 }
      )
    }

    const finding =
      typeof findingIndex === "number" && scan.findings?.[findingIndex]
        ? scan.findings[findingIndex]
        : undefined

    const now = new Date().toISOString()

    const userEntry = { role: "user" as const, content: message, timestamp: now }

    const aiResponse = await chatWithAI(
      message,
      {
        repoFullName: scan.repoFullName,
        summary: scan.summary,
        finding,
      },
      scan.chatHistory || []
    )

    const assistantEntry = {
      role: "assistant" as const,
      content: aiResponse,
      timestamp: new Date().toISOString(),
    }

    await db.collection("scans").updateOne(
      { _id: new ObjectId(id) },
      {
        $push: {
          chatHistory: { $each: [userEntry, assistantEntry] },
        },
      } as Record<string, unknown>
    )

    return NextResponse.json({
      success: true,
      response: aiResponse,
      userMessage: userEntry,
      assistantMessage: assistantEntry,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Chat endpoint failed", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
