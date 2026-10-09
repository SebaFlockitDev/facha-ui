import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Workspace } from "../src/project.js";
import { createServer } from "../src/server.js";

export const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "next-tw4-cssvars");

export async function connect(root: string, workspace?: Workspace) {
  const server = createServer({ root, workspace });
  const client = new Client({ name: "facha-ui-test", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      structuredContent?: any;
      content: { type: string; text: string }[];
    };
    return r;
  };
  return { client, call, close: () => client.close() };
}
