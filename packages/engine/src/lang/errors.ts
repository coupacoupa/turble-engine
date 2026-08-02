export class TelSyntaxError extends Error {
  constructor(
    message: string,
    public readonly pos: number,
  ) {
    super(message);
    this.name = "TelSyntaxError";
  }
}

export class TelRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelRuntimeError";
  }
}
