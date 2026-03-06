export class CliError extends Error {
  code: number;

  constructor(message: string, code = 1) {
    super(message);
    this.name = "CliError";
    this.code = code;
  }
}

export function isCliError(error: unknown): error is CliError {
  return error instanceof CliError;
}
