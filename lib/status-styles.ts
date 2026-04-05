/**
 * Shared status badge styling for model and test statuses.
 * Centralises badge colour logic that was previously duplicated
 * across dashboard, monitoring, upload-model, and upload-api pages.
 */

export type ModelStatus = "Running" | "Pending" | "Initializing" | "Loading" | "Failed" | "Stopped"
export type TestStatus = "pending" | "passed" | "failed" | "running"
export type TestPriority = "high" | "medium" | "low"

/**
 * Returns Tailwind class string for a model deployment status badge
 * @param {ModelStatus | string} status - The model's current status
 * @returns {string} Tailwind classes for badge colouring
 */
export function getModelStatusStyle(status: ModelStatus | string): string {
  switch (status) {
    case "Running":
      return "bg-success/10 text-success hover:bg-success/10"
    case "Pending":
    case "Initializing":
    case "Loading":
      return "bg-warning/10 text-warning hover:bg-warning/10"
    case "Failed":
      return "bg-error/10 text-error hover:bg-error/10"
    default:
      return "bg-muted text-muted-foreground hover:bg-muted"
  }
}

/**
 * Returns Tailwind class string for a test execution status badge
 * @param {TestStatus | string} status - The test's current status
 * @returns {string} Tailwind classes for badge colouring
 */
export function getTestStatusStyle(status: TestStatus | string): string {
  switch (status) {
    case "passed":
    case "completed":
      return "bg-success/10 text-success hover:bg-success/10"
    case "failed":
      return "bg-error/10 text-error hover:bg-error/10"
    case "running":
    case "testing":
      return "bg-warning/10 text-warning hover:bg-warning/10"
    default:
      return "bg-muted text-muted-foreground hover:bg-muted"
  }
}

/**
 * Returns Tailwind class string for a test priority badge
 * @param {TestPriority} priority - The test priority level
 * @returns {string} Tailwind classes for badge colouring
 */
export function getTestPriorityStyle(priority: TestPriority): string {
  switch (priority) {
    case "high":
      return "bg-error/10 text-error hover:bg-error/10"
    case "medium":
      return "bg-warning/10 text-warning hover:bg-warning/10"
    case "low":
      return "bg-info/10 text-info hover:bg-info/10"
  }
}
