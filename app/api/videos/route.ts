import crypto from "node:crypto";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { badRequest, json, optionalUuid, requireSameOrigin, route } from "@/lib/http";
import { FileTooLargeError, readHead, removeFile, saveStream } from "@/lib/storage";
import { limits, text } from "@/lib/validation";
import { VIDEO_COLUMNS, VIDEO_TYPES, looksLikeVideo, maxVideoBytes } from "@/lib/videos";

export const GET = route(async () => {
  const user = await requireUser(["COACH", "SUBSCRIBER"]);
  if (user.role === "COACH") {
    const result = await query(
      `select ${VIDEO_COLUMNS} from exercise_videos v where v.coach_id = $1 order by v.created_at desc`,
      [user.id]
    );
    return json({ videos: result.rows });
  }
  // Subscribers see videos assigned to them plus their coach's general videos.
  const result = await query(
    `select ${VIDEO_COLUMNS} from exercise_videos v inner join members m on m.coach_id = v.coach_id
     where m.user_id = $1 and (v.member_id is null or v.member_id = m.id)
     order by v.created_at desc`,
    [user.id]
  );
  return json({ videos: result.rows });
});

function header(request: Request, name: string) {
  try { return decodeURIComponent(request.headers.get(name) || ""); } catch { return ""; }
}

/**
 * Upload: the raw file is the request body (streamed to disk, never fully buffered in memory).
 * Metadata goes in URI-encoded headers: X-Video-Title, X-Video-Description, X-Video-Member.
 */
export const POST = route(async (request: Request) => {
  if (!requireSameOrigin(request)) return badRequest("مصدر الطلب غير صالح");
  const user = await requireUser(["COACH"]);

  const mimeType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const ext = VIDEO_TYPES[mimeType];
  if (!ext) return badRequest("صيغة غير مدعومة. الصيغ المسموحة: MP4 و WebM و MOV");

  const maxBytes = maxVideoBytes();
  const declared = Number(request.headers.get("content-length") || 0);
  const tooLarge = `حجم الملف أكبر من الحد المسموح (${Math.round(maxBytes / 1024 / 1024)} ميجابايت)`;
  if (declared > maxBytes) return json({ error: tooLarge }, { status: 413 });

  const title = text(header(request, "x-video-title"), limits.videoTitle);
  const description = text(header(request, "x-video-description"), limits.videoDescription);
  const memberId = optionalUuid(header(request, "x-video-member"));
  if (title.length < 2) return badRequest("عنوان المقطع يجب أن يكون حرفين على الأقل");
  if (memberId === undefined) return badRequest("المشترك غير صالح");
  if (!request.body) return badRequest("لم يتم إرسال ملف");

  if (memberId) {
    const owner = await query(`select id from members where id = $1 and coach_id = $2`, [memberId, user.id]);
    if (!owner.rows[0]) return json({ error: "المشترك غير صالح" }, { status: 403 });
  }

  const key = `${crypto.randomUUID()}.${ext}`;
  let size: number;
  try {
    size = await saveStream(key, request.body, maxBytes);
  } catch (error) {
    if (error instanceof FileTooLargeError) return json({ error: tooLarge }, { status: 413 });
    throw error;
  }

  try {
    if (size === 0 || !looksLikeVideo(await readHead(key, 12), ext)) {
      await removeFile(key);
      return badRequest("الملف ليس مقطع فيديو صالحًا");
    }
    const result = await query(
      `insert into exercise_videos(coach_id, member_id, title, description, storage_key, mime_type, size_bytes)
       values($1, $2, $3, $4, $5, $6, $7)
       returning id, title, description, member_id as "memberId", mime_type as "mimeType",
                 size_bytes::float8 as "sizeBytes", created_at as "createdAt"`,
      [user.id, memberId, title, description, key, mimeType, size]
    );
    return json({ video: result.rows[0] }, { status: 201 });
  } catch (error) {
    await removeFile(key);
    throw error;
  }
});
