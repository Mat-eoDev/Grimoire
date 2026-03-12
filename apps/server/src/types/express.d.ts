import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        user: Pick<User, "id" | "email" | "username" | "status">;
        sessionId: string;
      };
    }
  }
}

export {};

