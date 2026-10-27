import { requireAgent } from "@/lib/auth";
import { getSettings, prisma } from "@/lib/db";
import { ok, readBody, withRoute } from "@/lib/http";
import { serializeChatMessage } from "@/lib/serializers";
import { sendSupportMessageSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Backs InboxRepository.supportMessages() — oldest first, as the chat renders. */
export const GET = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);

  const messages = await prisma.supportMessage.findMany({
    where: { agentId: agent.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });

  // A brand-new thread opens with the welcome line.
  if (messages.length === 0) {
    const settings = await getSettings();
    const welcome = await prisma.supportMessage.create({
      data: {
        agentId: agent.id,
        text: settings.supportWelcomeMessage,
        fromAgent: false,
      },
    });
    return ok([serializeChatMessage(welcome)]);
  }

  return ok(messages.map(serializeChatMessage));
});

/**
 * Backs InboxRepository.sendSupportMessage() — stores the message and
 * returns the whole conversation, which is what the Dart method expects.
 */
export const POST = withRoute(async (request: Request) => {
  const agent = await requireAgent(request);
  const { text } = await readBody(request, sendSupportMessageSchema);

  await prisma.supportMessage.create({
    data: { agentId: agent.id, text, fromAgent: true },
  });

  const messages = await prisma.supportMessage.findMany({
    where: { agentId: agent.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
  });

  return ok(messages.map(serializeChatMessage), { status: 201 });
});
