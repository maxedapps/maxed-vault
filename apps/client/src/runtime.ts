export type PromptInput = (message: string) => string | null;
export type SignalHandler = () => void;
export type SpawnProcess = typeof Bun.spawn;

export interface CliRuntime {
  env: NodeJS.ProcessEnv;
  cwd: () => string;
  fetch: typeof fetch;
  promptInput: PromptInput;
  log: (...args: unknown[]) => void;
  writeStdout: (text: string) => void;
  readStdinText: () => Promise<string>;
  isStdinTTY: () => boolean;
  spawn: SpawnProcess;
  onSignal: (signal: NodeJS.Signals, handler: SignalHandler) => void;
  offSignal: (signal: NodeJS.Signals, handler: SignalHandler) => void;
}

export function createDefaultRuntime(): CliRuntime {
  const bunRuntime = (globalThis as { Bun?: typeof Bun }).Bun;

  return {
    env: process.env,
    cwd: () => process.cwd(),
    fetch: globalThis.fetch,
    promptInput: (message) => {
      const runtimePrompt = (globalThis as { prompt?: (msg: string) => string | null }).prompt;
      return runtimePrompt ? runtimePrompt(message) : null;
    },
    log: console.log,
    writeStdout: (text) => {
      process.stdout.write(text);
    },
    readStdinText: async () => {
      if (bunRuntime) {
        return bunRuntime.stdin.text();
      }

      return new Promise<string>((resolve, reject) => {
        let text = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => {
          text += chunk;
        });
        process.stdin.once("end", () => resolve(text));
        process.stdin.once("error", reject);
      });
    },
    isStdinTTY: () => {
      const stdin = bunRuntime?.stdin as { isTTY?: boolean | (() => boolean) } | undefined;

      if (stdin && typeof stdin.isTTY === "function") {
        return stdin.isTTY();
      }

      if (stdin && typeof stdin.isTTY === "boolean") {
        return stdin.isTTY;
      }

      return Boolean(process.stdin.isTTY);
    },
    spawn: ((options) => {
      if (!bunRuntime) {
        throw new Error("Bun runtime is required for process spawning");
      }

      return bunRuntime.spawn(options);
    }) as typeof Bun.spawn,
    onSignal: (signal, handler) => {
      process.on(signal, handler);
    },
    offSignal: (signal, handler) => {
      process.off(signal, handler);
    },
  };
}
