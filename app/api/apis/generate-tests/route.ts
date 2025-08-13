import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")
const APIS_FILE = path.join(DATA_DIR, "apis.json")
const ACTIVITY_LOG = path.join(process.cwd(), "data", "activity-log.md")

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
}

function loadApis(): ApiData[] {
  try {
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
    fs.writeFileSync(APIS_FILE, JSON.stringify(apis, null, 2))
  } catch (error) {
    console.error("Error saving APIs:", error)
  }
}

function logActivity(message: string) {
  const timestamp = new Date().toISOString()
  const logEntry = `## ${timestamp}\n- Feature: Test Generation\n- Summary: ${message}\n\n`
  fs.appendFileSync(ACTIVITY_LOG, logEntry)
}

// AI-powered test generation using Gemini API
async function generateTestCases(apiContent: string, description: string): Promise<TestCase[]> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyB81zsPZH9kZh_6aua67I7q9CV1iPOWYzc"
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

  try {
    // Prepare the prompt for Gemini
    const prompt = `Analyze the following API code and generate comprehensive test cases. 

API Code:
${apiContent}

API Description: ${description || "No description provided"}

Please generate 5-7 test cases that cover:
1. Authentication and authorization
2. Data validation and input validation
3. Error handling and edge cases
4. CRUD operations (if applicable)
5. Rate limiting and performance
6. Security vulnerabilities

For each test case, provide:
- A descriptive name
- A brief description of what it tests
- The actual test code in JavaScript/Jest format
- Expected behavior

Return the response as a JSON array with this structure:
[
  {
    "name": "Test Case Name",
    "description": "What this test case validates",
    "testCode": "describe('Test Suite', () => { it('should...', async () => { ... }) })"
  }
]`

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4000,
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response from Gemini API")
    }

    const generatedText = data.candidates[0].content.parts[0].text
    
    // Try to extract JSON from the response
    let testCasesData
    try {
      // Look for JSON array in the response
      const jsonMatch = generatedText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        testCasesData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error("No JSON array found in response")
      }
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError)
      console.log("Raw response:", generatedText)
      // Fallback to simulated test cases
      return generateFallbackTestCases()
    }

    // Convert Gemini response to our TestCase format
    const testCases: TestCase[] = testCasesData.map((testCase: any, index: number) => ({
      id: `test_${Date.now()}_${index + 1}`,
      name: testCase.name || `Generated Test ${index + 1}`,
      description: testCase.description || "AI-generated test case",
      testCode: testCase.testCode || `describe("Generated Test ${index + 1}", () => { it("should pass", () => { expect(true).toBe(true) }) })`,
      status: "pending",
      timestamp: new Date().toISOString(),
    }))

    return testCases

  } catch (error) {
    console.error("Gemini API error:", error)
    // Fallback to simulated test cases if API fails
    return generateFallbackTestCases()
  }
}

// Fallback test cases if Gemini API fails
function generateFallbackTestCases(): TestCase[] {
  const testCases: TestCase[] = [
    {
      id: `test_${Date.now()}_1`,
      name: "Authentication Test",
      description: "Tests API authentication with valid and invalid tokens",
      testCode: `describe("Authentication", () => {
  it("should authenticate with valid credentials", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username: "test", password: "password" });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("token");
  });

  it("should reject invalid credentials", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ username: "invalid", password: "wrong" });
    expect(response.status).toBe(401);
  });
});`,
      status: "pending",
      timestamp: new Date().toISOString(),
    },
    {
      id: `test_${Date.now()}_2`,
      name: "Data Validation Test",
      description: "Validates input data format and required fields",
      testCode: `describe("Data Validation", () => {
  it("should validate required fields", async () => {
    const response = await request(app)
      .post("/users")
      .send({ name: "John" }); // Missing email
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("error");
  });

  it("should accept valid data", async () => {
    const response = await request(app)
      .post("/users")
      .send({ name: "John", email: "john@example.com" });
    expect(response.status).toBe(201);
  });
});`,
      status: "pending",
      timestamp: new Date().toISOString(),
    },
    {
      id: `test_${Date.now()}_3`,
      name: "Rate Limiting Test",
      description: "Tests API rate limiting functionality",
      testCode: `describe("Rate Limiting", () => {
  it("should enforce rate limits", async () => {
    const requests = Array(10).fill(null).map(() => 
      request(app).get("/api/data")
    );
    
    const responses = await Promise.all(requests);
    const tooManyRequests = responses.filter(r => r.status === 429);
    expect(tooManyRequests.length).toBeGreaterThan(0);
  });
});`,
      status: "pending",
      timestamp: new Date().toISOString(),
    },
    {
      id: `test_${Date.now()}_4`,
      name: "Error Handling Test",
      description: "Tests proper error responses for edge cases",
      testCode: `describe("Error Handling", () => {
  it("should handle invalid routes", async () => {
    const response = await request(app).get("/invalid-route");
    expect(response.status).toBe(404);
  });

  it("should handle server errors gracefully", async () => {
    const response = await request(app).get("/api/error");
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty("error");
  });
});`,
      status: "pending",
      timestamp: new Date().toISOString(),
    },
    {
      id: `test_${Date.now()}_5`,
      name: "CRUD Operations Test",
      description: "Tests Create, Read, Update, Delete operations",
      testCode: `describe("CRUD Operations", () => {
  let itemId: string;

  it("should create a new item", async () => {
    const response = await request(app)
      .post("/items")
      .send({ name: "Test Item", description: "Test Description" });
    expect(response.status).toBe(201);
    itemId = response.body.id;
  });

  it("should read the created item", async () => {
    const response = await request(app).get(\`/items/\${itemId}\`);
    expect(response.status).toBe(200);
    expect(response.body.name).toBe("Test Item");
  });

  it("should update the item", async () => {
    const response = await request(app)
      .put(\`/items/\${itemId}\`)
      .send({ name: "Updated Item" });
    expect(response.status).toBe(200);
  });

  it("should delete the item", async () => {
    const response = await request(app).delete(\`/items/\${itemId}\`);
    expect(response.status).toBe(204);
  });
});`,
      status: "pending",
      timestamp: new Date().toISOString(),
    },
  ]

  return testCases
}

export async function POST(request: Request) {
  try {
    const { apiId } = await request.json()

    if (!apiId) {
      return NextResponse.json(
        {
          success: false,
          error: "API ID is required",
        },
        { status: 400 },
      )
    }

    const apis = loadApis()
    const api = apis.find((a) => a.id === apiId)

    if (!api) {
      return NextResponse.json(
        {
          success: false,
          error: "API not found",
        },
        { status: 404 },
      )
    }

    // Read the API file content
    let apiContent = ""
    try {
      apiContent = fs.readFileSync(api.filePath, "utf8")
    } catch (error) {
      console.error("Error reading API file:", error)
      apiContent = "// API file content could not be read"
    }

    // Generate test cases
    const testCases = await generateTestCases(apiContent, api.description || "")

    // Update API with generated test cases
    api.testCases = testCases
    api.status = "testing"
    api.totalTests = testCases.length
    api.passedTests = 0
    api.failedTests = 0
    api.lastTested = new Date().toISOString()

    saveApis(apis)

    logActivity(`Generated ${testCases.length} test cases for API '${api.name}'`)

    return NextResponse.json({
      success: true,
      testCases,
      message: `Generated ${testCases.length} test cases`,
    })
  } catch (error) {
    console.error("Test generation error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate test cases",
      },
      { status: 500 },
    )
  }
} 