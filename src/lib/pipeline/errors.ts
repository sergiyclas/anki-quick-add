export type PipelineStep = "input" | "config" | "anki" | "dedupe" | "generate" | "validate" | "mapping" | "write";
export type PipelineAction = "openOptions" | "startAnki";

export class PipelineError extends Error {
  constructor(
    public readonly step: PipelineStep,
    message: string,
    public readonly action?: PipelineAction,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}
