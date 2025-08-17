import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

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

async function logActivity(message: string) {
  try {
    const client = await clientPromise;
    const db = client.db("DeployZen");
    await db.collection("activity_log").insertOne({
      timestamp: new Date(),
      feature: "APIs",
      summary: message,
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

async function generateAITestCases(apiContent: string, apiName: string, description: string): Promise<TestCase[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ""
  
  if (!GEMINI_API_KEY) {
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

    let jsonText = generatedText.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/, '').replace(/\n?```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/, '').replace(/\n?```$/, '')
    }

    const testObjects = JSON.parse(jsonText)
    
    if (!Array.isArray(testObjects)) {
      throw new Error('Generated content is not an array')
    }

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
  return [{
    id: `test_${Date.now()}_1`,
    name: `Basic API Test`,
    description: "Basic test for the uploaded API",
    testCode: `describe('${apiName} API', () => {\n  it('should be accessible', async () => {\n    const response = await fetch('/api/endpoint');\n    expect(response).toBeDefined();\n  });\n});`,
    status: "pending",
    timestamp: new Date().toISOString(),
  }]
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

    const content = (api as any).content || ''
    if (!content) {
        return NextResponse.json({ success: false, error: "API content not found, cannot generate tests" }, { status: 400 })
    }

    const testCases = await generateAITestCases(content, api.name, api.description || "")

    await db.collection("apis").updateOne(
      { _id: new ObjectId(apiId) },
      {
        $set: {
          testCases: testCases,
          status: "testing",
          totalTests: testCases.length,
          passedTests: 0,
          failedTests: 0,
          lastTested: new Date().toISOString()
        }
      }
    )

    await logActivity(`Generated ${testCases.length} AI-powered test cases for API '${api.name}'`)

    return NextResponse.json({ success: true, testCases, message: `Generated ${testCases.length} test cases` })

  } catch (e: any) {
    console.error('Test generation error:', e)
    return NextResponse.json({ success: false, error: "Failed to generate test cases" }, { status: 500 })
  }
}