import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import {
  coerceGeneratedTestCase,
  extractRoutesFromApiContent,
  generateDeterministicTestCases,
  StructuredTestCase,
} from "@/lib/api-test-utils"

async function logActivity(message: string) {
  try {
    const client = await clientPromise
    const db = client.db("DeployZen")
    await db.collection("activity_log").insertOne({
      timestamp: new Date(),
      feature: "APIs",
      summary: message,
    })
  } catch (error) {
    console.error("Error logging activity:", error)
  }
}

async function generateAITestCases(apiContent: string, apiName: string, description: string): Promise<StructuredTestCase[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
  const inferredRoutes = extractRoutesFromApiContent(apiContent)

  if (!GEMINI_API_KEY) {
    return generateDeterministicTestCases(apiContent, apiName, description)
  }

  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
  const prompt = `Analyze the uploaded API and generate a JSON array of structured API contract tests.

API name: ${apiName}
User description: ${description || "No additional description provided."}
Inferred routes:
${inferredRoutes.map((route) => `- ${route.method} ${route.path} | auth=${route.requiresAuth} | source=${route.source}`).join("\n")}

API source:
${apiContent}

Return ONLY valid JSON with 6 to 10 objects. Every object must have:
{
  "name": "short title",
  "description": "what the test validates",
  "category": "happy-path | validation | auth | security | edge-case",
  "priority": "high | medium | low",
  "method": "GET | POST | PUT | PATCH | DELETE",
  "path": "/resource",
  "headers": { "Header-Name": "value" },
  "query": { "key": "value" },
  "body": { "field": "value" },
  "expectedStatus": 200,
  "expectedBodyShape": ["fieldA", "fieldB"],
  "tags": ["tag-one"],
  "assumptions": ["short note"]
}

Rules:
- Prefer the inferred routes above.
- Create broad coverage across happy-path, validation, auth, security, and edge cases.
- Do not return executable JavaScript.
- Do not wrap the JSON in markdown fences.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          topP: 0.8,
          topK: 40,
        },
      }),
    })

    if (!response.ok) {
      console.error("Gemini API error:", response.status, response.statusText)
      return generateDeterministicTestCases(apiContent, apiName, description)
    }

    const data = await response.json()
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

    if (!generatedText) {
      return generateDeterministicTestCases(apiContent, apiName, description)
    }

    let jsonText = generatedText.trim()
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/, "").replace(/\n?```$/, "")
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/, "").replace(/\n?```$/, "")
    }

    const parsed = JSON.parse(jsonText)
    if (!Array.isArray(parsed)) {
      throw new Error("Generated content is not an array")
    }

    const testCases = parsed.map((test, index) => coerceGeneratedTestCase(test, index))
    return testCases.length > 0 ? testCases.slice(0, 10) : generateDeterministicTestCases(apiContent, apiName, description)
  } catch (error) {
    console.error("Error generating AI test cases:", error)
    return generateDeterministicTestCases(apiContent, apiName, description)
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

    const content = (api as any).content || ""
    if (!content) {
      return NextResponse.json({ success: false, error: "API content not found, cannot generate tests" }, { status: 400 })
    }

    const testCases = await generateAITestCases(content, api.name, api.description || "")

    await db.collection("apis").updateOne(
      { _id: new ObjectId(apiId) },
      {
        $set: {
          testCases,
          status: "testing",
          totalTests: testCases.length,
          passedTests: 0,
          failedTests: 0,
          lastTested: new Date().toISOString(),
        },
      }
    )

    await logActivity(`Generated ${testCases.length} structured test cases for API '${api.name}'`)

    return NextResponse.json({ success: true, testCases, message: `Generated ${testCases.length} test cases` })
  } catch (error: any) {
    console.error("Test generation error:", error)
    return NextResponse.json({ success: false, error: "Failed to generate test cases" }, { status: 500 })
  }
}
