import { Pool } from "pg";
import { env } from "../lib/env";
import { hashPassword } from "../lib/security";

async function main() {
  const coachEmail = (process.env.SEED_COACH_EMAIL || "coach@example.com").toLowerCase();
  const coachPassword = process.env.SEED_COACH_PASSWORD;
  const coachName = process.env.SEED_COACH_NAME || "Coach";
  const memberEmail = (process.env.SEED_MEMBER_EMAIL || "member@example.com").toLowerCase();
  const memberPassword = process.env.SEED_MEMBER_PASSWORD;
  const memberName = process.env.SEED_MEMBER_NAME || "Demo Member";

  if (!coachPassword || !memberPassword) {
    throw new Error("Set SEED_COACH_PASSWORD and SEED_MEMBER_PASSWORD");
  }

  const pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined
  });

  try {
    const coachHash = await hashPassword(coachPassword);
    const memberHash = await hashPassword(memberPassword);

    const coachResult = await pool.query(
      `insert into users(role, email, password_hash, name) values('COACH', $1, $2, $3)
       on conflict(email) do update set password_hash = excluded.password_hash, name = excluded.name
       returning id`,
      [coachEmail, coachHash, coachName]
    );

    const memberUserResult = await pool.query(
      `insert into users(role, email, password_hash, name) values('SUBSCRIBER', $1, $2, $3)
       on conflict(email) do update set password_hash = excluded.password_hash, name = excluded.name
       returning id`,
      [memberEmail, memberHash, memberName]
    );

    const coachId = coachResult.rows[0].id;
    const memberUserId = memberUserResult.rows[0].id;

    await pool.query(
      `insert into members(coach_id, user_id, name, weight_kg, adherence, subscription_days, status, sleep_hours, last_activity)
       select $1, $2, $3, 80, 75, 30, 'ACTIVE', 8, $4
       where not exists(select 1 from members where user_id = $2)`,
      [coachId, memberUserId, memberName, new Date().toISOString().slice(0, 10)]
    );

    console.log(`Seeded coach: ${coachEmail}`);
    console.log(`Seeded subscriber: ${memberEmail}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
