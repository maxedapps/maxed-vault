import { json } from "../response";

export function handleHealth(): Response {
  return json({ status: "ok" });
}
