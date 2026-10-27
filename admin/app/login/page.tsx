import type { Metadata } from "next";
import { loginAction } from "@/app/actions";
import { ActionForm, Field, SubmitButton } from "@/components/form";

export const metadata: Metadata = { title: "Sign in · 1XBET Agent Admin" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-3xl font-black italic tracking-tight text-brand">
            1XBET
          </p>
          <p className="mt-1 text-sm tracking-[0.2em] text-white/70">
            ADMIN PANEL
          </p>
        </div>

        <div className="rounded-3xl bg-white p-7 shadow-xl">
          <h1 className="text-xl font-bold text-navy">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Operations access for the agent network.
          </p>

          <ActionForm action={loginAction} className="mt-6 space-y-4">
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              placeholder="admin@onexbet.app"
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
            <SubmitButton className="w-full">Sign in</SubmitButton>
          </ActionForm>
        </div>

        <p className="mt-6 text-center text-xs text-white/50">
          Agents sign in through the mobile app, not here.
        </p>
      </div>
    </main>
  );
}
