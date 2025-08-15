import { NextRequest, NextResponse } from "next/server"
import { handleSecurityAnalysis } from "../[[...rest]]/route"

export async function POST(req: NextRequest) {
  return handleSecurityAnalysis(req)
}