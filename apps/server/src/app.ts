import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";

import { env } from "./env.js";
import { attachAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { dataExchangeRouter } from "./routes/dataExchange.js";
import { inventoryRouter } from "./routes/inventory.js";
import { tradesRouter } from "./routes/trades.js";
import { HttpError } from "./lib/http.js";

export const app = express();

// Derriere le proxy HTTPS de l'hebergeur (Render) : indispensable pour les cookies "secure".
app.set("trust proxy", 1);

// En production, le serveur sert aussi le build du front React (meme origine => pas de souci CORS/cookies).
// apps/server/dist/src/app.js -> ../../../web/dist
const webDistPath = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../web/dist");
const hasWebBuild = fs.existsSync(path.join(webDistPath, "index.html"));

if (hasWebBuild) {
  // Fichiers statiques (JS/CSS, images, assets des des 3D) servis sans passer par l'auth.
  app.use(express.static(webDistPath));
}

app.use(
  cors({
    origin: env.clientOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(attachAuth);

app.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    now: new Date().toISOString()
  });
});

app.use("/api/auth", authRouter);
app.use("/api", campaignsRouter);
app.use("/api", inventoryRouter);
app.use("/api", tradesRouter);
app.use("/api", dataExchangeRouter);

// Fallback SPA : toute autre route GET renvoie index.html (react-router gere la navigation cote client).
// Place APRES les routes d'API pour ne pas les intercepter.
if (hasWebBuild) {
  app.get("*", (_request, response) => {
    response.sendFile(path.join(webDistPath, "index.html"));
  });
}

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
