export interface HeadlessJsonlOptions {
  projectRoot: string;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

export function readHeadlessSnapshot(
  projectRoot: string,
): Promise<Record<string, unknown>>;
export function runHeadlessJsonl(options: HeadlessJsonlOptions): Promise<void>;
