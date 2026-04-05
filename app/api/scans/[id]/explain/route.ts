import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import logger from "@/lib/logger"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

/**
 * Generates an AI explanation for a single Semgrep finding
 * @param {object} finding - The finding to explain
 * @returns {Promise<string>} AI-generated explanation
 */
async function explainFinding(finding: {
  ruleId: string
  severity: string
  message: string
  snippet: string
  filePath: string
  startLine: number
  endLine: number
}): Promise<string> {
  if (!GEMINI_API_KEY) return "AI explanation unavailable (GEMINI_API_KEY not configured)."

  const prompt = `You are a security expert. Explain the following code vulnerability finding concisely.

**Rule:** ${finding.ruleId}
**Severity:** ${finding.severity}
**File:** ${finding.filePath} (lines ${finding.startLine}-${finding.endLine})
**Scanner Message:** ${finding.message}

**Code Snippet:**
\`\`\`
${finding.snippet}
\`\`\`

Provide:
1. What the vulnerability is (1-2 sentences)
2. Why it is dangerous (1-2 sentences)
3. How to fix it (concrete code suggestion)

Keep the response under 300 words.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
      }),
    })

    if (!response.ok) {
      logger.error("Gemini API request failed", { status: response.status })
      return "AI explanation failed (API request error)."
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No explanation available."
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Error generating AI explanation", { error: message })
    return `AI explanation failed: ${message}`
  }
}

/**
 * POST — Explains a specific finding using AI, with caching
 * @param {NextRequest} req - Request body: { findingIndex }
 * @param {object} context - Route params containing scan ID
 * @returns {NextResponse} AI explanation text
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { findingIndex } = await req.json()

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid scan ID" },
        { status: 400 }
      )
    }

    if (typeof findingIndex !== "number" || findingIndex < 0) {
      return NextResponse.json(
        { success: false, error: "findingIndex must be a non-negative number" },
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

    if (!scan.findings || findingIndex >= scan.findings.length) {
      return NextResponse.json(
        { success: false, error: "Finding index out of range" },
        { status: 400 }
      )
    }

    const cacheKey = String(findingIndex)
    if (scan.aiExplanations?.[cacheKey]) {
      return NextResponse.json({
        success: true,
        explanation: scan.aiExplanations[cacheKey],
        cached: true,
      })
    }

    const explanation = await explainFinding(scan.findings[findingIndex])

    await db.collection("scans").updateOne(
      { _id: new ObjectId(id) },
      { $set: { [`aiExplanations.${cacheKey}`]: explanation } }
    )

    return NextResponse.json({ success: true, explanation, cached: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    logger.error("Explain finding failed", { error: message })
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
