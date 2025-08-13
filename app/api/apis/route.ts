import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const APIS_FILE = path.join(DATA_DIR, "apis.json")
const APIS_DIR = path.join(DATA_DIR, "apis")
const ACTIVITY_LOG = path.join(DATA_DIR, "activity-log.md")

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(APIS_DIR)) {
    fs.mkdirSync(APIS_DIR, { recursive: true })
  }
}

interface TestCase {
  id: string
  name: string
  description: string
  testCode: string
  status: "pending" | "passed" | "failed" | "running"
  result?: string
  error?: string
  executionTime?: number
  timestamp?: string
}

interface ApiData {
  id: string
  name: string
  description?: string
  filePath: string
  fileName: string
  fileSize: number
  testCases: TestCase[]
  status: "uploaded" | "testing" | "completed"
  createdAt: string
  lastTested?: string
  totalTests: number
  passedTests: number
  failedTests: number
  securityAnalysis: string
}

function loadApis(): ApiData[] {
  try {
    ensureDirectories()

    if (fs.existsSync(APIS_FILE)) {
      const data = fs.readFileSync(APIS_FILE, "utf8")
      return JSON.parse(data)
    }
  } catch (error) {
    console.error("Error loading APIs:", error)
  }
  return []
}

function saveApis(apis: ApiData[]) {
  try {
    ensureDirectories()
    fs.writeFileSync(APIS_FILE, JSON.stringify(apis, null, 2))
  } catch (error) {
    console.error("Error saving APIs:", error)
  }
}

function logActivity(message: string) {
  const timestamp = new Date().toISOString()
  const logEntry = `## ${timestamp}\n- Feature: API Upload\n- Summary: ${message}\n\n`
  fs.appendFileSync(ACTIVITY_LOG, logEntry)
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

export async function GET() {
  try {
    const apis = loadApis()
    return NextResponse.json({
      success: true,
      apis,
    })
  } catch (error) {
    console.error("Error in GET /api/apis:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load APIs",
        apis: [],
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const apiFile = formData.get("apiFile") as File
    const description = formData.get("description") as string

    if (!apiFile) {
      return NextResponse.json(
        {
          success: false,
          error: "API file is required",
        },
        { status: 400 },
      )
    }

    const apiId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const fileName = `${apiId}_${apiFile.name}`
    const filePath = path.join(APIS_DIR, fileName)

    // Save the uploaded file
    const buffer = Buffer.from(await apiFile.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    let apiContent = ""
    if (apiFile) {
      apiContent = Buffer.from(await apiFile.arrayBuffer()).toString("utf8")
    }

    const securityAnalysis = apiContent ? await getSecurityAnalysis(apiContent) : "No security analysis available."

    const apiData: ApiData = {
      id: apiId,
      name: apiFile.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      description: description || "",
      filePath,
      fileName: apiFile.name,
      fileSize: apiFile.size,
      testCases: [],
      status: "uploaded",
      createdAt: new Date().toISOString(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      securityAnalysis,
    }

    // Save API data
    const apis = loadApis()
    apis.push(apiData)
    saveApis(apis)

    logActivity(`Uploaded API '${apiFile.name}' (${apiFile.size} bytes)${description ? ` - ${description}` : ''}`)

    return NextResponse.json({
      success: true,
      apiId,
      message: "API uploaded successfully",
      securityAnalysis,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Upload failed",
      },
      { status: 500 },
    )
  }
} 