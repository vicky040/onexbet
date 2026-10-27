/**
 * The shape every server action returns. This lives outside app/actions.ts
 * because a "use server" module may only export async functions.
 */
export type ActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const idleState: ActionState = { status: "idle" };
