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
  suggestion?: string
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
  const logEntry = `## ${timestamp}\n- Feature: Test Execution\n- Summary: ${message}\n\n`
  fs.appendFileSync(ACTIVITY_LOG, logEntry)
}

// Simulate test execution
async function executeTest(testCase: TestCase): Promise<TestCase> {
  const startTime = Date.now()
  
  // Simulate test execution time
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500))
  
  const executionTime = Date.now() - startTime
  
  // Simulate test results (80% pass rate for demo)
  const passed = Math.random() > 0.2
  
  return {
    ...testCase,
    status: passed ? "passed" : "failed",
    result: passed ? "Test passed successfully" : "Test failed: Expected status 200, got 404",
    error: passed ? undefined : "AssertionError: Expected status 200, got 404",
    executionTime,
    timestamp: new Date().toISOString(),
  }
}

async function getCorrectionSuggestion(testCode: string, error: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyB81zsPZH9kZh_6aua67I7q9CV1iPOWYzc"
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"
  const prompt = `A test case failed with the following error:\n${error}\n\nTest code:\n${testCode}\n\nSuggest a correction or improvement for the test code, and explain why it failed and how to fix it. Be concise and actionable.`
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }] }
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 }
      })
    })
    if (!response.ok) return "No suggestion available."
    const data = await response.json()
    const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text || "No suggestion available."
    return suggestion
  } catch {
    return "No suggestion available."
  }
}

export async function POST(request: Request) {
  try {
    const { apiId, testIds } = await request.json()

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

    // Execute specified tests or all tests if none specified
    const testsToExecute = testIds 
      ? api.testCases.filter(test => testIds.includes(test.id))
      : api.testCases

    if (testsToExecute.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No tests to execute",
        },
        { status: 400 },
      )
    }

    // Execute tests
    const executedTests: TestCase[] = []
    let passedCount = 0
    let failedCount = 0

    for (const testCase of testsToExecute) {
      const executedTest = await executeTest(testCase)
      // If failed, get correction suggestion
      if (executedTest.status === "failed") {
        executedTest.suggestion = await getCorrectionSuggestion(executedTest.testCode, executedTest.error || "")
      }
      executedTests.push(executedTest)
      
      if (executedTest.status === "passed") {
        passedCount++
      } else {
        failedCount++
      }
    }

    // Update API with test results
    api.testCases = api.testCases.map(test => {
      const executedTest = executedTests.find(et => et.id === test.id)
      return executedTest || test
    })
    
    api.status = "completed"
    api.lastTested = new Date().toISOString()
    api.passedTests = passedCount
    api.failedTests = failedCount

    saveApis(apis)

    logActivity(`Executed ${executedTests.length} tests for API '${api.name}' (${passedCount} passed, ${failedCount} failed)`)

    return NextResponse.json({
      success: true,
      results: executedTests,
      summary: {
        total: executedTests.length,
        passed: passedCount,
        failed: failedCount,
        successRate: (passedCount / executedTests.length) * 100,
      },
      message: `Executed ${executedTests.length} tests`,
    })
  } catch (error) {
    console.error("Test execution error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to execute tests",
      },
      { status: 500 },
    )
  }
} 