import { getServerUrl } from "../config";

export async function cmdStatus(): Promise<void> {
  const server = getServerUrl();
  console.log(`Server: ${server}`);

  try {
    const res = await fetch(`${server}/health`);
    const data = await res.json();
    console.log(`Health: ${data.status}`);
  } catch (err) {
    console.error(`Health: unreachable (${(err as Error).message})`);
    process.exit(1);
  }
}
