import { requireFullAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { ok, readBody, withRoute } from "@/lib/http";
import { adminSupportMessage, agentRef } from "@/lib/admin-serializers";
import { adminReplySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agentId: string }> };

/** The whole thread, oldest first. Reading it marks the agent's messages read. */
export const GET = withRoute(async (_request: Request, { params }: Params) => {
  await requireFullAdmin();
  const { agentId } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, mobile: true, status: true },
  });
  if (!agent) throw ApiError.notFound("Agent");

  const messages = await prisma.supportMessage.findMany({
    where: { agentId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  await prisma.supportMessage.updateMany({
    where: { agentId, fromAgent: true, readByAdmin: false },
    data: { readByAdmin: true },
  });

  return ok({
    agent: agentRef(agent),
    messages: messages.map(adminSupportMessage),
  });
});

/** Replies as support. The agent sees it in the app's chat. */
export const POST = withRoute(async (request: Request, { params }: Params) => {
  const admin = await requireFullAdmin();
  const { agentId } = await params;
  const { text } = await readBody(request, adminReplySchema);

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true },
  });
  if (!agent) throw ApiError.notFound("Agent");

  const message = await prisma.supportMessage.create({
    data: { agentId, text, fromAgent: false, adminId: admin.id },
  });

  return ok(adminSupportMessage(message), { status: 201 });
});
