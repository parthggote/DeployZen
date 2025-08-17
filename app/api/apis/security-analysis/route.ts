import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

async function getSecurityAnalysis(apiContent: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
  if (!GEMINI_API_KEY) return "No security analysis available (GEMINI_API_KEY not configured)."
  if (!apiContent) return "No security analysis available (API content is empty)."

  const prompt = `Analyze the following API code for security vulnerabilities, best practices, and potential issues. List any problems and suggest improvements.\n\nAPI Code:\n${apiContent}`
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
      })
    })
    if (!response.ok) {
      console.error("Gemini API request failed:", response.status, response.statusText);
      return "Security analysis failed (API request error)."
    }
    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No security analysis available."
  } catch (error: any) {
    console.error("Error getting security analysis:", error);
    return `Security analysis failed: ${error.message}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiId } = await req.json()
    if (!apiId || !ObjectId.isValid(apiId)) {
        return NextResponse.json({ success: false, error: "Invalid API ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")

    const api = await db.collection("apis").findOne({ _id: new ObjectId(apiId) })

    if (!api) {
        return NextResponse.json({ success: false, error: "API not found" }, { status: 404 })
    }

    // The API content should be stored in the 'content' field of the document.
    // The migration script needs to be updated to add this field.
    // For now, we handle the case where it might be missing.
    const content = (api as any).content || ''

    const analysis = await getSecurityAnalysis(content)

    // Save the analysis back to the API document
    await db.collection("apis").updateOne(
        { _id: new ObjectId(apiId) },
        { $set: { securityAnalysis: analysis, lastAnalyzed: new Date().toISOString() } }
    )

    return NextResponse.json({ success: true, securityAnalysis: analysis })
  } catch (error: any) {
    console.error("Security analysis API error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}