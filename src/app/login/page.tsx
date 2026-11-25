import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setupProblem } from "@/lib/config";
import { currentUser } from "@/lib/user";
import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!setupProblem() && await currentUser()) redirect("/search");
  const notice = setupProblem() || (sp.reason === "ended" ? "Your sign-in has ended. Sign in again to carry on." : undefined);
  return (
    <main className="login">
      <section className="art" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dark.svg" alt="" width={220} height={51} />
        <div>
          <p className="big">Find the right person in the time it takes to ask.</p>
          <p className="sub">Search every candidate by words, skills, experience and stage, open a profile, and move people through your roles, from any browser.</p>
        </div>
        <svg className="pulse" viewBox="0 0 760 110" preserveAspectRatio="xMinYMid slice">
          <path d="M0 70h250l26-22 22 22h44l30-64 34 104 26-58h328" stroke="#D80097" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span />
      </section>
      <section className="form-side">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="mobile-logo logo-light" src="/logo.svg" alt="Propulse" width={170} height={39} />
          <LoginForm next={sp.next || ""} notice={notice} />
        </div>
      </section>
    </main>
  );
}
