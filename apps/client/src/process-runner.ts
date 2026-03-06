import { CliError } from "./errors";
import type { CliRuntime } from "./runtime";

const FORWARDED_SIGNALS: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

export async function runProcess(
  runtime: CliRuntime,
  command: string[],
  env: NodeJS.ProcessEnv,
): Promise<number> {
  let child: Bun.Subprocess<"inherit", "inherit", "inherit">;

  try {
    child = runtime.spawn({
      cmd: command,
      env,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
  } catch (error) {
    throw new CliError(`Failed to start command: ${(error as Error).message}`);
  }

  const handlers = new Map<NodeJS.Signals, () => void>();

  for (const signal of FORWARDED_SIGNALS) {
    const handler = () => {
      if (child.exitCode === null && !child.killed) {
        child.kill(signal);
      }
    };

    handlers.set(signal, handler);
    runtime.onSignal(signal, handler);
  }

  try {
    return await child.exited;
  } finally {
    for (const [signal, handler] of handlers) {
      runtime.offSignal(signal, handler);
    }
  }
}
