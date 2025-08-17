import { ObjectId } from "mongodb";
import fetch from "node-fetch";
import { _private as modelActions } from "./route";

// Mock dependencies
jest.mock("@/lib/mongodb", () => ({
  __esModule: true,
  default: Promise.resolve({
    db: () => ({
      collection: () => ({
        updateOne: jest.fn().mockResolvedValue({}),
        insertOne: jest.fn().mockResolvedValue({}),
      }),
    }),
  }),
}));

jest.mock("node-fetch", () => jest.fn());

const mockFetch = fetch as jest.Mock;

describe("deployWithOllama", () => {
  let logActivitySpy: jest.SpyInstance;
  let updateModelStatusSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logActivitySpy = jest.spyOn(modelActions, "logActivity").mockResolvedValue();
    updateModelStatusSpy = jest
      .spyOn(modelActions, "updateModelStatus")
      .mockResolvedValue();
  });

  afterEach(() => {
    logActivitySpy.mockRestore();
    updateModelStatusSpy.mockRestore();
  });

  it("should fail deployment if Ollama is not running", async () => {
    // Arrange
    const modelData = {
      _id: new ObjectId(),
      id: "model-id-123",
      modelName: "test-model",
      filePath: "/path/to/model",
      mode: "ollama" as const,
      tokens: 2048,
      batchSize: 32,
      status: "Pending" as const,
      createdAt: new Date().toISOString(),
    };
    mockFetch.mockResolvedValue({ ok: false });

    // Act
    const result = await modelActions.deployWithOllama(modelData);

    // Assert
    expect(result).toBe(false);
    expect(updateModelStatusSpy).toHaveBeenCalledWith(modelData._id, "Failed");
    expect(logActivitySpy).toHaveBeenCalledWith(
      '❌ Ollama deployment failed for "test-model": Ollama is not running.'
    );
  });
});
