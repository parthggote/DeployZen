import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const APIS_FILE = path.join(DATA_DIR, "apis.json")

function loadApis() {
  if (!fs.existsSync(APIS_FILE)) return []
  return JSON.parse(fs.readFileSync(APIS_FILE, "utf8"))
}

async function getSecurityAnalysis(apiContent: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyB81zsPZH9kZh_6aua67I7q9CV1iPOWYzc"
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
  const prompt = `Analyze the following API code for security vulnerabilities, best practices, and potential issues. List any problems and suggest improvements.\n\nAPI Code:\n${apiContent}`
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }] }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
      })
    })
    if (!response.ok) return "No security analysis available."
    const data = await response.json()
    const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text || "No security analysis available."
    return analysis
  } catch {
    return "No security analysis available."
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiId } = await req.json()
    const apis = loadApis()
    const api = apis.find((a: any) => a.id === apiId)
    if (!api || !api.filePath || !fs.existsSync(api.filePath)) {
      return NextResponse.json({ success: false, error: "API file not found" }, { status: 404 })
    }
    const apiContent = fs.readFileSync(api.filePath, "utf8")
    const securityAnalysis = await getSecurityAnalysis(apiContent)
    return NextResponse.json({ success: true, securityAnalysis })
  } catch {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}