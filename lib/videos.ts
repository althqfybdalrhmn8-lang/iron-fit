export const VIDEO_TYPES: Record<string, "mp4" | "webm" | "mov"> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};

export function maxVideoBytes() {
  const mb = Number(process.env.VIDEO_MAX_MB || 200);
  return (Number.isFinite(mb) && mb > 0 ? mb : 200) * 1024 * 1024;
}

/** Checks the file's real signature, so a renamed non-video file is rejected regardless of the declared type. */
export function looksLikeVideo(head: Buffer, ext: "mp4" | "webm" | "mov") {
  if (ext === "webm") return head.length >= 4 && head.readUInt32BE(0) === 0x1a45dfa3;
  if (head.length < 8) return false;
  const box = head.subarray(4, 8).toString("latin1");
  return ext === "mp4" ? box === "ftyp" : ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(box);
}

export const VIDEO_COLUMNS = `v.id, v.title, v.description, v.member_id as "memberId", v.mime_type as "mimeType",
  v.size_bytes::float8 as "sizeBytes", v.created_at as "createdAt"`;
