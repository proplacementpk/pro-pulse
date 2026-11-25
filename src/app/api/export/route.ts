/** Downloads a list as an Excel sheet. */
import { NextResponse } from "next/server";
import { buildSheet, type ShareRequest } from "@/lib/share";
import { ApiError } from "@/lib/supabase";
import { currentUser } from "@/lib/user";

export const maxDuration = 60;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Your sign-in has ended. Refresh the page and sign in again." }, { status: 401 });
  try {
    const sheet = await buildSheet(user, (await req.json()) as ShareRequest);
    return new NextResponse(new Uint8Array(sheet.data), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${sheet.name}"`,
        "Cache-Control": "private, no-store", "X-Rows": String(sheet.rows),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "The sheet could not be made." }, { status: e instanceof ApiError ? e.status : 500 });
  }
}
