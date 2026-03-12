import { Router } from "express";

import { prisma } from "../lib/prisma.js";

export const referencesRouter = Router();

referencesRouter.get("/", async (_request, response, next) => {
  try {
    const [races, classes, actorTemplates] = await Promise.all([
      prisma.race.findMany({ orderBy: { name: "asc" } }),
      prisma.characterClass.findMany({ orderBy: { name: "asc" } }),
      prisma.actorTemplate.findMany({ orderBy: { name: "asc" } })
    ]);

    response.json({
      races,
      classes,
      actorTemplates
    });
  } catch (error) {
    next(error);
  }
});
