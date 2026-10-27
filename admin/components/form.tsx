"use client";

import {
  useActionState,
  useEffect,
  useRef,
  type ReactNode,
  type SelectHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { idleState, type ActionState } from "@/lib/action-state";

/** Form plumbing: pending states, confirmations and the result message. */

type ServerAction = (state: ActionState, form: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className,
  confirm,
  resetOnSuccess = false,
  hideMessage = false,
}: {
  action: ServerAction;
  children: ReactNode;
  className?: string;
  /** Shown in a confirmation dialog before the action runs. */
  confirm?: string;
  resetOnSuccess?: boolean;
  hideMessage?: boolean;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") ref.current?.reset();
  }, [resetOnSuccess, state]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      {!hideMessage && state.status !== "idle" && state.message ? (
        <p
          role="status"
          className={clsx(
            "mt-3 rounded-lg px-3 py-2 text-xs font-medium",
            state.status === "error"
              ? "bg-danger-soft text-danger"
              : "bg-success-soft text-success",
          )}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

const VARIANTS = {
  primary: "bg-navy text-white hover:bg-navy-soft",
  secondary: "border border-line bg-white text-ink hover:border-sky hover:text-sky",
  success: "bg-success text-white hover:brightness-110",
  danger: "bg-danger text-white hover:brightness-110",
  ghost: "text-muted hover:text-navy hover:underline",
} as const;

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        VARIANTS[variant],
        className,
      )}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function Field({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      <input className="field" {...props} />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Select({
  label,
  hint,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      <select className="field" {...props}>
        {children}
      </select>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Textarea({
  label,
  hint,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      <textarea className="field" rows={3} {...props} />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Checkbox({
  label,
  hint,
  name,
  defaultChecked,
}: {
  label: string;
  hint?: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 accent-[var(--color-navy)]"
      />
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

/** A collapsible panel for forms that would otherwise crowd a list page. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="card group overflow-hidden [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-semibold text-ink">
        {summary}
        <span className="text-xs font-medium text-sky group-open:hidden">Open</span>
        <span className="hidden text-xs font-medium text-muted group-open:inline">
          Close
        </span>
      </summary>
      <div className="border-t border-line p-5">{children}</div>
    </details>
  );
}
