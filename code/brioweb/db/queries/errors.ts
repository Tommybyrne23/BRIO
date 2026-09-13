import "server-only";

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConsentRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsentRequiredError";
  }
}
