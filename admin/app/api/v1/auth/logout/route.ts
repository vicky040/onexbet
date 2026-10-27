import { z } from "zod";
import { requireAgent, revokeAllRefreshTokens, revokeRefreshToken } from "@/lib/auth";
import { ok, withRoute } from "@/lib/http";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
    /** Sign out of every device. */
    all: z.boolean().optional(),
  })
  .optional();

export const POST = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);

  // The body is optional: a client with only an access token can still log out.
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    body = undefined;
  }

  if (body?.all || !body?.refreshToken) {
    await revokeAllRefreshTokens(agent.id);
  } else {
    await revokeRefreshToken(body.refreshToken);
  }

  return ok({ loggedOut: true });
});
