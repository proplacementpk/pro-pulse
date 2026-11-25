"use client";
import { useActionState } from "react";
import { Submit } from "@/components/client";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action] = useActionState<LoginState, FormData>(signIn, {});
  return (
    <form action={action}>
      <h1>Sign in</h1>
      <p className="muted">Use the same email and password as in the Propulse desktop app.</p>
      {state.error ? <p className="notice bad" role="alert">{state.error}</p> : notice ? <p className="notice warn">{notice}</p> : null}
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" defaultValue={state.email || ""} required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Submit busy="Signing in…">Sign in</Submit>
      <p className="small muted">New here? An admin creates your account and switches it on.</p>
    </form>
  );
}
