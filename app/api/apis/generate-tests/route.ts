import { NextRequest, NextResponse } from "next/server"
import { handleGenerateTests } from "../[[...rest]]/route"

export async function POST(req: NextRequest) {
  return handleGenerateTests(req)
}