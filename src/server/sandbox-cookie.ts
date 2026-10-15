import { createHmac, timingSafeEqual } from "node:crypto";

import { isSandboxSchemaName } from "@/lib/sandbox";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function mac(schema: string, key: string): string {
  return createHmac("sha256", key).update(`sandbox:${schema}`).digest("hex");
}

/** The ch_sandbox cookie value: `<schema>.<hmac>`, signed with SESSION_SECRET. The browser cannot name a schema it was not given. */
export function signSandboxCookie(schema: string, key: string = secret()): string {
  if (!isSandboxSchemaName(schema)) throw new Error("Invalid sandbox schema name");
  return `${schema}.${mac(schema, key)}`;
}

/** The schema name in a ch_sandbox value, or undefined when it is missing, malformed or not signed by us. */
export function verifySandboxCookie(value: string | undefined, key?: string): string | undefined {
  if (!value) return undefined;
  const dot = value.indexOf(".");
  if (dot === -1) return undefined;
  const schema = value.slice(0, dot);
  if (!isSandboxSchemaName(schema)) return undefined;
  let expected: Buffer;
  try {
    expected = Buffer.from(mac(schema, key ?? secret()), "hex");
  } catch {
    return undefined; // no SESSION_SECRET: no sandbox
  }
  const given = Buffer.from(value.slice(dot + 1), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected) ? schema : undefined;
}
