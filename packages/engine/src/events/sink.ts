import { ExecutionEvent } from "./types";

/**
 * Receives events as they are produced. A collector builds the in-memory log;
 * a streaming sink can forward them live (RPC stream, live UI, tracer).
 */
export interface EventSink {
  emit(event: ExecutionEvent): void;
}

export class CollectorSink implements EventSink {
  readonly events: ExecutionEvent[] = [];

  emit(event: ExecutionEvent): void {
    this.events.push(event);
  }
}

/** Fans a single event stream out to multiple sinks. */
export class TeeSink implements EventSink {
  constructor(private readonly sinks: EventSink[]) {}

  emit(event: ExecutionEvent): void {
    for (const sink of this.sinks) sink.emit(event);
  }
}
