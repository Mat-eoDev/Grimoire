import cors from "cors";
import express from "express";

import { env } from "./env.js";
import { attachAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { combatsRouter } from "./routes/combats.js";
import { referencesRouter } from "./routes/references.js";
import { rewardsRouter } from "./routes/rewards.js";
import { scenesRouter } from "./routes/scenes.js";
import { HttpError } from "./lib/http.js";

export const app = express();

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true
  })
);
app.use(express.json());
app.use(attachAuth);

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    now: new Date().toISOString()
  });
});

app.use("/auth", authRouter);
app.use("/references", referencesRouter);
app.use("/", campaignsRouter);
app.use("/", scenesRouter);
app.use("/", combatsRouter);
app.use("/", rewardsRouter);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: "Erreur interne du serveur"
  });
});

