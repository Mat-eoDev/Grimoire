import { createHash, randomBytes } from "node:crypto";

import { prisma } from "./prisma.js";

export function createSessionToken() {
  return randomBytes(32).toString("hex");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt
    }
  });

  return {
    session,
    token
  };
}

export async function resolveSession(token: string) {
  const tokenHash = hashSessionToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          status: true,
          isAdmin: true
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session;
}

export async function destroySessionById(sessionId: string) {
  await prisma.session.deleteMany({
    where: { id: sessionId }
  });
}

