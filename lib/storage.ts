import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * File storage for exercise videos. Files live on local disk under UPLOAD_DIR
 * (default ./storage). Storage keys are always server-generated, never user input.
 *
 * To move to S3 / R2 later, re-implement these four functions; nothing else changes.
 * Note: serverless hosts (e.g. Vercel) have no persistent disk — use a server/VPS
 * with a persistent volume, or switch to object storage there.
 */

const KEY_RE = /^[0-9a-f-]{36}\.(mp4|webm|mov)$/;

function root() {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "storage"), "videos");
}

function resolveKey(key: string) {
  if (!KEY_RE.test(key)) throw new Error("Invalid storage key");
  return path.join(root(), key);
}

export class FileTooLargeError extends Error {}

/** Streams `body` to storage, aborting (and deleting the partial file) once it exceeds maxBytes. Returns bytes written. */
export async function saveStream(key: string, body: ReadableStream<Uint8Array>, maxBytes: number) {
  await fsp.mkdir(root(), { recursive: true });
  const target = resolveKey(key);
  let size = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) callback(new FileTooLargeError("File too large"));
      else callback(null, chunk);
    }
  });
  try {
    await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), limiter, fs.createWriteStream(target, { flags: "wx" }));
    return size;
  } catch (error) {
    await fsp.rm(target, { force: true });
    throw error;
  }
}

export async function readHead(key: string, bytes: number) {
  const handle = await fsp.open(resolveKey(key), "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function openRange(key: string, start: number, end: number) {
  return Readable.toWeb(fs.createReadStream(resolveKey(key), { start, end })) as ReadableStream<Uint8Array>;
}

export async function removeFile(key: string) {
  await fsp.rm(resolveKey(key), { force: true });
}
