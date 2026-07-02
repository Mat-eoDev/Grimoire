import { createHash, randomBytes } from "node:crypto";

import { Router } from "express";

import { env } from "../env.js";
import { clearSessionCookie, HttpError, assertString, setSessionCookie } from "../lib/http.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../lib/mailer.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { createSession, destroySessionById } from "../lib/session.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/register", async (request, response, next) => {
  try {
    const body = request.body as Record<string, unknown>;
    const email = assertString(body.email, "email").toLowerCase();
    const username = assertString(body.username, "username");
    const password = assertString(body.password, "password");

    if (password.length < 8) {
      throw new HttpError(400, "Le mot de passe doit contenir au moins 8 caracteres");
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }]
      }
    });

    if (existing) {
      throw new HttpError(409, "Un compte existe deja avec cet email ou ce pseudo");
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: hashPassword(password)
      },
      select: {
        id: true,
        email: true,
        username: true,
        status: true
      }
    });

    const { token } = await createSession(user.id);
    setSessionCookie(response, env.sessionCookieName, token);

    // Envoi du mail de bienvenue en arriere-plan (n'impacte pas la reponse ni l'inscription).
    void sendWelcomeEmail({ to: user.email, username: user.username });

    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (request, response, next) => {
  try {
    const body = request.body as Record<string, unknown>;
    const email = assertString(body.email, "email").toLowerCase();
    const password = assertString(body.password, "password");

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, "Identifiants invalides");
    }

    const { token } = await createSession(user.id);
    setSessionCookie(response, env.sessionCookieName, token);

    response.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/forgot-password", async (request, response, next) => {
  try {
    const body = request.body as Record<string, unknown>;
    const email = assertString(body.email, "email").toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });

    // On envoie l'email seulement si le compte existe, mais on repond toujours
    // pareil pour ne pas reveler quelles adresses ont un compte.
    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 heure

      // On invalide les anciennes demandes de ce compte.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt }
      });

      const base = env.appUrl || env.clientOrigin;
      const resetUrl = `${base}/reset-password?token=${token}`;
      void sendPasswordResetEmail({ to: user.email, username: user.username, resetUrl });
    }

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", async (request, response, next) => {
  try {
    const body = request.body as Record<string, unknown>;
    const token = assertString(body.token, "token");
    const password = assertString(body.password, "password");

    if (password.length < 8) {
      throw new HttpError(400, "Le mot de passe doit contenir au moins 8 caracteres");
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new HttpError(400, "Lien invalide ou expire. Refais une demande.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: hashPassword(password) }
      }),
      // Le lien est consomme et toute session active est revoquee (deconnexion partout).
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
      prisma.session.deleteMany({ where: { userId: record.userId } })
    ]);

    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    await destroySessionById(auth.sessionId);
    clearSessionCookie(response, env.sessionCookieName);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const memberships = await prisma.campaignMember.findMany({
      where: {
        userId: auth.user.id
      },
      include: {
        campaign: true
      },
      orderBy: {
        joinedAt: "desc"
      }
    });

    response.json({
      user: auth.user,
      campaigns: memberships.map((membership) => ({
        memberId: membership.id,
        role: membership.role,
        campaign: {
          id: membership.campaign.id,
          title: membership.campaign.title,
          joinCode: membership.campaign.joinCode,
          status: membership.campaign.status
        }
      }))
    });
  } catch (error) {
    next(error);
  }
});

