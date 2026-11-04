import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { isUuid, notFound, route } from "@/lib/http";
import { openRange } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Streams a video the current user may watch. Supports HTTP Range so players can seek. */
export const GET = route<Ctx>(async (request, { params }) => {
  const user = await requireUser(["COACH", "SUBSCRIBER"]);
  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const result = await query<{ storage_key: string; mime_type: string; size_bytes: string }>(
    user.role === "COACH"
      ? `select storage_key, mime_type, size_bytes from exercise_videos where id = $1 and coach_id = $2`
      : `select v.storage_key, v.mime_type, v.size_bytes
         from exercise_videos v inner join members m on m.coach_id = v.coach_id
         where v.id = $1 and m.user_id = $2 and (v.member_id is null or v.member_id = m.id)`,
    [id, user.id]
  );
  const video = result.rows[0];
  if (!video) return notFound();

  const size = Number(video.size_bytes);
  const baseHeaders = {
    "Content-Type": video.mime_type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff"
  };

  const range = request.headers.get("range");
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (range && match && (match[1] || match[2])) {
    let start: number;
    let end: number;
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else {
      // Suffix range: last N bytes.
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${size}` } });
    }
    return new Response(openRange(video.storage_key, start, end), {
      status: 206,
      headers: { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) }
    });
  }

  return new Response(openRange(video.storage_key, 0, size - 1), {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) }
  });
});
