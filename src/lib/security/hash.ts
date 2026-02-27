import { createHash, randomBytes } from "crypto";

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createToken() {
  return randomBytes(32).toString("hex");
}
