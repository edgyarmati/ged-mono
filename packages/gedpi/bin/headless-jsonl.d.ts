export interface HeadlessJsonlOptions {
  projectRoot: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export interface HeadlessSnapshot {
  projectRoot: string;
  workId: string;
  gedInitialized: boolean;
  durable: {
    project?: string;
    architecture?: string;
    patterns?: string;
  };
  activeWork: {
    spec?: string;
    tasks?: string;
    tests?: string;
    notes?: string;
  };
  runtime: {
    state?: string;
    sessionSummary?: string;
    checkpoints?: Record<string, unknown>;
    checkpointError?: string;
  };
  settings: Record<string, unknown>;
}

export interface HeadlessSession {
  threadId: string;
  status: "ready" | "running" | "error" | "closed";
  runtimeMode: string;
  cwd: string;
  activeTurnId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HeadlessTurn {
  turnId: string;
  input: string;
  state: "completed" | "failed" | "interrupted";
  createdAt: string;
}

export function readHeadlessSnapshot(
  projectRoot: string,
): Promise<HeadlessSnapshot>;

export function runHeadlessJsonl(options: HeadlessJsonlOptions): Promise<void>;
