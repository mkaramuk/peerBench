export class ForwardError extends Error {
  startedAt: Date;

  constructor(message: string, options?: ErrorOptions & { startedAt: Date }) {
    super(message, options);
    this.startedAt = options?.startedAt || new Date();
  }
}
