import { getServerUrl } from "./config";

export async function vaultFetch(
  path: string,
  opts?: RequestInit,
): Promise<Response> {
  const base = getServerUrl();
  return fetch(`${base}${path}`, opts);
}
