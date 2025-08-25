export class InvalidTaskError extends Error {
  constructor(message?: string) {
    super(message || "Task is in an invalid format");
    this.name = "InvalidTaskError";
  }
}

export class TaskNotRecognizedError extends InvalidTaskError {
  constructor() {
    super("Task is not recognized");
    this.name = "TaskNotRecognizedError";
  }
}
