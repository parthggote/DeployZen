import { type NextRequest, NextResponse } from "next/server";
import { getOnnxSession } from "../deploy/route";

export async function POST(request: NextRequest) {
  try {
    const { modelId, inputData } = await request.json();

    if (!modelId || !inputData) {
      return NextResponse.json({ success: false, error: "Model ID and input data are required" }, { status: 400 });
    }

    const session = getOnnxSession(modelId);

    if (!session) {
      return NextResponse.json({ success: false, error: `ONNX session not found for model ID: ${modelId}` }, { status: 404 });
    }

    // Prepare input tensors (this part will depend on the specific ONNX model's input requirements)
    // For demonstration, assuming inputData is an object where keys are input names and values are arrays of numbers
    const feeds: Record<string, ort.Tensor> = {};
    for (const key in inputData) {
      if (Object.prototype.hasOwnProperty.call(inputData, key)) {
        // Assuming float32 for now, adjust type and dimensions as per model
        feeds[key] = new ort.Tensor('float32', inputData[key], [1, inputData[key].length]); 
      }
    }

    const results = await session.run(feeds);

    // Process results (this part will depend on the specific ONNX model's output requirements)
    const output: Record<string, any> = {};
    for (const key in results) {
      if (Object.prototype.hasOwnProperty.call(results, key)) {
        output[key] = results[key].data;
      }
    }

    return NextResponse.json({ success: true, output });
  } catch (error) {
    console.error("ONNX inference error:", error);
    return NextResponse.json({ success: false, error: "ONNX inference failed" }, { status: 500 });
  }
}