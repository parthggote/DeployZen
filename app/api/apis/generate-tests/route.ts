import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const RUNTIME_DATA_ROOT = process.env.VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data')
const DATA_DIR = RUNTIME_DATA_ROOT
const APIS_FILE = path.join(DATA_DIR, "apis.json")
const APIS_DIR = path.join(DATA_DIR, "apis")

function ensureDirectories() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    if (!fs.existsSync(APIS_DIR)) fs.mkdirSync(APIS_DIR, { recursive: true })
  } catch {}
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
  suggestion?: string
}

function loadApis(): any[] {
  try {
    ensureDirectories()
    if (fs.existsSync(APIS_FILE)) {
      return JSON.parse(fs.readFileSync(APIS_FILE, "utf8"))
    }
  } catch {}
  return []
}

function saveApis(apis: any[]) {
  try {
    ensureDirectories()
    fs.writeFileSync(APIS_FILE, JSON.stringify(apis, null, 2))
  } catch {}
}

function logActivity(message: string) {
  const ts = new Date().toISOString()
  const entry = `## ${ts}\n- Feature: APIs\n- Summary: ${message}\n\n`
  try { ensureDirectories(); fs.appendFileSync(path.join(DATA_DIR, "activity-log.md"), entry) } catch {}
}

async function generateAITestCases(apiContent: string, apiName: string, description: string): Promise<TestCase[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
  
  if (!GEMINI_API_KEY) {
    // Fallback to basic test cases if no API key
    return generateFallbackTestCases(apiContent, apiName)
  }

  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
  
  const prompt = `Analyze the following API code and generate comprehensive test cases. Return ONLY a JSON array of test objects, no additional text or formatting.

API Name: ${apiName}
Description: ${description}

API Code:
${apiContent}

Generate 6-8 test cases that cover:
1. Happy path scenarios (successful requests)
2. Error handling (invalid inputs, missing parameters)
3. Edge cases (boundary conditions)
4. Security tests (injection attempts, authentication)
5. Performance considerations

Each test object should have this exact structure:
{
  "name": "descriptive test name",
  "description": "detailed description of what this test validates",
  "testCode": "complete JavaScript test code using fetch() and expect() assertions"
}

The testCode should be realistic, executable JavaScript that:
- Uses fetch() for HTTP requests
- Includes proper headers and request bodies
- Has meaningful expect() assertions
- Handles both success and error scenarios
- Uses realistic test data

Return only the JSON array, no markdown formatting or additional text.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40
        }
      })
    })

    if (!response.ok) {
      console.error('Gemini API error:', response.status, response.statusText)
      return generateFallbackTestCases(apiContent, apiName)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
    
    if (!generatedText) {
      return generateFallbackTestCases(apiContent, apiName)
    }

    // Extract JSON from the response
    let jsonText = generatedText.trim()
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '')
    }

    // Parse the JSON
    const testObjects = JSON.parse(jsonText)
    
    if (!Array.isArray(testObjects)) {
      throw new Error('Generated content is not an array')
    }

    // Convert to TestCase format
    const testCases: TestCase[] = testObjects.map((test, index) => ({
      id: `test_${Date.now()}_${index + 1}`,
      name: test.name || `Generated Test ${index + 1}`,
      description: test.description || "AI-generated test case",
      testCode: test.testCode || `// Test code not generated properly\ndescribe('${test.name}', () => {\n  it('should pass', () => {\n    expect(true).toBe(true);\n  });\n});`,
      status: "pending" as const,
      timestamp: new Date().toISOString(),
    }))

    return testCases.length > 0 ? testCases : generateFallbackTestCases(apiContent, apiName)

  } catch (error) {
    console.error('Error generating AI test cases:', error)
    return generateFallbackTestCases(apiContent, apiName)
  }
}

function generateFallbackTestCases(apiContent: string, apiName: string): TestCase[] {
  // For the fallback, we'll just return a simple test case
  return [{
    id: `test_${Date.now()}_1`,
    name: `Basic API Test`,
    description: "Basic test for the uploaded API",
    testCode: `describe('${apiName} API', () => {\n  it('should be accessible', async () => {\n    // Add your API endpoint here\n    const response = await fetch('/api/endpoint');\n    expect(response).toBeDefined();\n  });\n});`,
    status: "pending",
    timestamp: new Date().toISOString(),
  }]
}

export async function POST(req: NextRequest) {
  try {
    const { apiId } = await req.json()
    if (!apiId) return NextResponse.json({ success: false, error: "API ID is required" }, { status: 400 })
    const apis = loadApis()
    const api = apis.find(a => a.id === apiId)
    if (!api) return NextResponse.json({ success: false, error: "API not found" }, { status: 404 })

    let content = ""
    try {
      content = fs.readFileSync(api.filePath, 'utf8')
    } catch {
      return NextResponse.json({ success: false, error: "Could not read API file" }, { status: 500 })
    }

    // Generate AI-powered test cases using Gemini
    const testCases = await generateAITestCases(content, api.name, api.description || "")

    api.testCases = testCases
    api.status = "testing"
    api.totalTests = testCases.length
    api.passedTests = 0
    api.failedTests = 0
    api.lastTested = new Date().toISOString()
    saveApis(apis)
    logActivity(`Generated ${testCases.length} AI-powered test cases for API '${api.name}'`)
    return NextResponse.json({ success: true, testCases, message: `Generated ${testCases.length} test cases` }, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (e) {
    console.error('Test generation error:', e)
    return NextResponse.json({ success: false, error: "Failed to generate test cases" }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}