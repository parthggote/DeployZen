import { NextRequest, NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { StructuredTestCase, validateStructuredTest } from "@/lib/api-test-utils"

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

async function executeStructuredTest(test: StructuredTestCase, apiContent: string) {
  try {
    return validateStructuredTest(test, apiContent)
  } catch (error: any) {
    return {
      passed: false,
      result: "Static contract validation failed",
      error: error.message || "Test execution failed",
      suggestion: "Review the uploaded API content and regenerate the tests.",
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiId, testIds } = await req.json()
    if (!apiId || !ObjectId.isValid(apiId)) {
      return NextResponse.json({ success: false, error: "Invalid API ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("DeployZen")
    const api = await db.collection("apis").findOne({ _id: new ObjectId(apiId) })

    if (!api) {
      return NextResponse.json({ success: false, error: "API not found" }, { status: 404 })
    }

    const allTests = ((api as any).testCases || []) as StructuredTestCase[]
    const testsToExecute = testIds
      ? allTests.filter((test) => testIds.includes(test.id))
      : allTests

    if (testsToExecute.length === 0) {
      return NextResponse.json({ success: false, error: "No tests to execute" }, { status: 400 })
    }

    const apiContent = (api as any).content || ""
    const executed: StructuredTestCase[] = []
    let passed = 0
    let failed = 0

    for (const test of testsToExecute) {
      const start = Date.now()
      const testResult = await executeStructuredTest(test, apiContent)
      const executionTime = Date.now() - start

      const executedTest: StructuredTestCase = {
        ...test,
        status: testResult.passed ? "passed" : "failed",
        result: testResult.result,
        error: testResult.error,
        suggestion: testResult.suggestion,
        executionTime,
        timestamp: new Date().toISOString(),
      }

      executed.push(executedTest)
      if (testResult.passed) {
        passed++
      } else {
        failed++
      }
    }

    const updatedTestCases = allTests.map((test) => executed.find((item) => item.id === test.id) || test)

    await db.collection("apis").updateOne(
      { _id: new ObjectId(apiId) },
      {
        $set: {
          testCases: updatedTestCases,
          status: "completed",
          lastTested: new Date().toISOString(),
          passedTests: passed,
          failedTests: failed,
        },
      }
    )

    await logActivity(`Validated ${executed.length} test cases for API '${api.name}' (${passed} passed, ${failed} failed)`)

    return NextResponse.json({
      success: true,
      results: executed,
      summary: {
        total: executed.length,
        passed,
        failed,
        successRate: executed.length > 0 ? (passed / executed.length) * 100 : 0,
      },
      mode: "static-contract-validation",
      message: `Validated ${executed.length} tests`,
    })
  } catch (error: any) {
    console.error("Test execution error:", error)
    return NextResponse.json({ success: false, error: "Failed to execute tests" }, { status: 500 })
  }
}
