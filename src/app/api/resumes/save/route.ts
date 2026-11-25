/** Step two of adding a resume: store the file in Google Drive and save the checked details. */
import { NextResponse } from "next/server";
import { commitResume, type Mode } from "@/lib/intake";
import { fileInfo } from "@/lib/resume";
import { ApiError } from "@/lib/supabase";
import { currentUser } from "@/lib/user";

export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Your sign-in has ended. Refresh the page and sign in again." }, { status: 401 });
  try {
    const form = await req.formData();
    const info = await fileInfo(form.get("file") as File | null);
    const fields = JSON.parse(String(form.get("fields") || "{}"));
    const mode = String(form.get("mode") || "new") as Mode;
    const target = String(form.get("target") || "") || null;
    if (!["new", "update", "attach"].includes(mode)) throw new ApiError("That is not a way to save a resume.");
    if (target && !/^[0-9a-f-]{36}$/i.test(target)) throw new ApiError("That profile does not exist.");
    if (mode !== "attach" && !String(fields.full_name || "").trim()) throw new ApiError("A candidate needs a name.");
    return NextResponse.json(await commitResume(user, fields, info, mode, target));
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "The candidate could not be saved. Try again." }, { status });
  }
}
