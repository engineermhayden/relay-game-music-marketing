import { db } from "@/lib/db";
import { greetingSchema, searchSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const parsed = searchSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return Response.json(
      { error: "Invalid search parameters." },
      { status: 400 },
    );
  const { latitude, longitude, radius, search } = parsed.data;
  try {
    const { rows } = await db.query(
      `SELECT id,name,message,city,seeded,created_at,
      ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude,
      round((ST_Distance(location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)/1000)::numeric,1)::float AS distance
      FROM greetings WHERE ST_DWithin(location,ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3)
      AND (name ILIKE $4 OR city ILIKE $4 OR message ILIKE $4)
      ORDER BY created_at DESC,id LIMIT 200`,
      [
        longitude,
        latitude,
        radius * 1000,
        `%${search.replace(/[\\%_]/g, "\\$&")}%`,
      ],
    );
    const stats = await db.query(
      "SELECT count(*)::int AS total, count(DISTINCT city)::int AS cities FROM greetings",
    );
    return Response.json({ greetings: rows, stats: stats.rows[0], limit: 200 });
  } catch {
    return Response.json(
      { error: "Could not load greetings. Check the database connection." },
      { status: 503 },
    );
  }
}
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 8192)
    return Response.json({ error: "Request too large." }, { status: 413 });
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (
        origin !== new URL(request.url).origin &&
        new URL(origin).host !== request.headers.get("host")
      )
        return Response.json({ error: "Origin not allowed." }, { status: 403 });
    } catch {
      return Response.json({ error: "Invalid origin." }, { status: 403 });
    }
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8192)
      return Response.json({ error: "Request too large." }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = greetingSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      {
        error:
          "Please provide a name (1–60), message (1–240), city (1–80), and valid coordinates.",
      },
      { status: 400 },
    );
  try {
    const { name, message, city, longitude, latitude } = parsed.data;
    const { rows } = await db.query(
      "INSERT INTO greetings(name,message,city,location) VALUES($1,$2,$3,ST_SetSRID(ST_MakePoint($4,$5),4326)::geography) RETURNING id",
      [name, message, city, longitude, latitude],
    );
    return Response.json({ id: rows[0].id }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Greeting could not be saved. Please try again." },
      { status: 503 },
    );
  }
}
