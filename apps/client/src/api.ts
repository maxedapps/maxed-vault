import { CliError } from "./errors";

interface ApiClientOptions {
  serverUrl: string;
  fetchImpl?: typeof fetch;
}

function joinUrl(serverUrl: string, path: string): string {
  return new URL(path, `${serverUrl}/`).toString();
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new CliError(`Invalid JSON response from server (${response.status})`);
  }
}

export function createVaultClient(options: ApiClientOptions) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await fetchImpl(joinUrl(options.serverUrl, path), init);
    } catch (error) {
      throw new CliError(`Request failed: ${(error as Error).message}`);
    }

    const payload = await parseJsonResponse<{ error?: string } & T>(response);

    if (!response.ok) {
      throw new CliError(payload?.error ?? `Request failed (${response.status})`);
    }

    if (payload === null) {
      throw new CliError(`Empty response from server (${response.status})`);
    }

    return payload as T;
  }

  return {
    health(): Promise<{ status: string }> {
      return requestJson<{ status: string }>("/health");
    },
    createProject(name: string): Promise<{ name: string; created: boolean }> {
      return requestJson<{ name: string; created: boolean }>("/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    },
    listProjects(): Promise<{ projects: string[] }> {
      return requestJson<{ projects: string[] }>("/projects");
    },
    getProject(name: string): Promise<{ name: string }> {
      return requestJson<{ name: string }>(`/projects/${encodeURIComponent(name)}`);
    },
    listSecrets(project: string, prefix = ""): Promise<{ project: string; names: string[] }> {
      return requestJson<{ project: string; names: string[] }>(
        `/projects/${encodeURIComponent(project)}/secrets?prefix=${encodeURIComponent(prefix)}`,
      );
    },
    getSecret(project: string, name: string): Promise<{ project: string; name: string; value: string }> {
      return requestJson<{ project: string; name: string; value: string }>(
        `/projects/${encodeURIComponent(project)}/secrets/${encodeURIComponent(name)}`,
      );
    },
    setSecret(
      project: string,
      name: string,
      value: string,
    ): Promise<{ project: string; name: string; created: boolean }> {
      return requestJson<{ project: string; name: string; created: boolean }>(
        `/projects/${encodeURIComponent(project)}/secrets/${encodeURIComponent(name)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
        },
      );
    },
    deleteSecret(project: string, name: string): Promise<{ project: string; name: string; deleted: boolean }> {
      return requestJson<{ project: string; name: string; deleted: boolean }>(
        `/projects/${encodeURIComponent(project)}/secrets/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
    },
    getEnv(project: string): Promise<{ project: string; secrets: Array<{ name: string; value: string }> }> {
      return requestJson<{ project: string; secrets: Array<{ name: string; value: string }> }>(
        `/projects/${encodeURIComponent(project)}/env`,
      );
    },
  };
}
