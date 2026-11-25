"use server";
import { emailSheet, type ShareRequest } from "@/lib/share";
import { currentUser } from "@/lib/user";

export async function emailListAction(req: ShareRequest, to: string, subject: string, message: string): Promise<{ ok: boolean; message: string }> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Your sign-in has ended. Refresh the page and sign in again." };
  try {
    const sent = await emailSheet(user, req, to, subject, message);
    return { ok: true, message: `Sent to ${sent.join(", ")}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "The email could not be sent." };
  }
}
