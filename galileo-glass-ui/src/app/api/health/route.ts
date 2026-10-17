import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { rows } = await db.query(
      "SELECT PostGIS_Lib_Version() AS postgis, (SELECT count(*)::int FROM greetings) AS greetings",
    );
    return Response.json({
      status: "healthy",
      database: "PostgreSQL + PostGIS",
      ...rows[0],
    });
  } catch {
    return Response.json(
      { status: "unavailable", message: "Database is not ready." },
      { status: 503 },
    );
  }
}
