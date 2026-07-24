export interface AsmError {
  line: number;
  message: string;
}

export class AsmFatal extends Error {
  constructor(
    public readonly line: number,
    message: string,
  ) {
    super(message);
  }
}
