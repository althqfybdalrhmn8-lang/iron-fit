import type { PoolClient } from "pg";
import { isUuid } from "./http";

export const MAX_PROGRAM_VIDEOS = 20;

/** Thrown inside a transaction to roll it back when a video link is not allowed. */
export class InvalidVideosError extends Error {}

/** Program columns plus its linked videos (in the coach's chosen order) as a JSON array. */
export const PROGRAM_COLUMNS = `p.id, p.title, p.description, p.member_id as "memberId", p.days,
  coalesce((
    select json_agg(json_build_object('id', v.id, 'title', v.title) order by pv.position)
    from program_videos pv inner join exercise_videos v on v.id = pv.video_id
    where pv.program_id = p.id
  ), '[]'::json) as videos`;

/** Parses `videoIds`: undefined when absent, null when invalid, otherwise a de-duplicated id list. */
export function parseVideoIds(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_PROGRAM_VIDEOS || !value.every(isUuid)) return null;
  return [...new Set(value as string[])];
}

/**
 * Replaces the program's video links. Each video must belong to the coach and be watchable by
 * the program's member (a general video, or one assigned to that same member); otherwise the
 * member would see a video in their program that they aren't allowed to stream.
 * Returns false (and changes nothing) if any id fails that check.
 */
export async function setProgramVideos(
  client: PoolClient, programId: string, coachId: string, memberId: string | null, videoIds: string[]
) {
  if (videoIds.length) {
    const allowed = await client.query<{ id: string }>(
      `select id from exercise_videos
       where coach_id = $1 and id = any($2::uuid[])
         and (member_id is null or member_id is not distinct from $3::uuid)`,
      [coachId, videoIds, memberId]
    );
    if (allowed.rows.length !== videoIds.length) return false;
  }
  await client.query(`delete from program_videos where program_id = $1`, [programId]);
  if (videoIds.length) {
    await client.query(
      `insert into program_videos(program_id, video_id, position)
       select $1, id, ord from unnest($2::uuid[]) with ordinality as t(id, ord)`,
      [programId, videoIds]
    );
  }
  return true;
}

/** After a program's member changes, drop links to videos the new member can't watch. */
export async function pruneProgramVideos(client: PoolClient, programId: string, memberId: string | null) {
  await client.query(
    `delete from program_videos pv using exercise_videos v
     where pv.program_id = $1 and v.id = pv.video_id
       and v.member_id is not null and v.member_id is distinct from $2::uuid`,
    [programId, memberId]
  );
}
