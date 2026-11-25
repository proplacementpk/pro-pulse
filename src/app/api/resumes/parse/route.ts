/** Step one of adding a resume: read the file with Gemini and look for people it may already belong to. */
import { NextResponse } from "next/server";
import { duplicates } from "@/lib/data";
import { fileInfo, parseResume } from "@/lib/resume";
import { ApiError } from "@/lib/supabase";
import { currentUser } from "@/lib/user";

export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Your sign-in has ended. Refresh the page and sign in again." }, { status: 401 });
  try {
    const form = await req.formData();
    const info = await fileInfo(form.get("file") as File | null);
    const parsed = await parseResume(user.db, info);
    return NextResponse.json({
      parsed, file: { name: info.name, ext: info.ext, size: info.size, hash: info.hash },
      duplicates: await duplicates(user, info.hash, parsed.email),
    });
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "The resume could not be read. Try again." }, { status });
  }
}
