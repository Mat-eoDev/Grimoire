import { randomBytes } from "node:crypto";

import { MemberRole, SceneElementType } from "@prisma/client";
import { Router } from "express";

import { assertString, HttpError, optionalString, requireArray } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

export const dataExchangeRouter = Router();

const EXPORT_FORMAT = "grimoire.campaign";
const EXPORT_VERSION = 1;

function generateJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

async function createUniqueJoinCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateJoinCode();
    const existing = await prisma.campaign.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new HttpError(500, "Impossible de generer un code de partie");
}

/**
 * GET /campaigns/:campaignId/export — exporte une campagne en JSON portable (MJ uniquement).
 *
 * Interoperabilite (Bloc 4) :
 * - flux SYNCHRONE requete/reponse (le flux temps reel SSE est l'asynchrone) ;
 * - table de correspondance `memberRef` (index stable) au lieu des identifiants internes :
 *   aucune reference orpheline, mapping source/cible explicite ;
 * - RGPD : on n'exporte NI email, NI hash de mot de passe, NI identifiant technique — seulement
 *   le pseudo public et les donnees de jeu ;
 * - donnees consolidees calculees a la volee dans `summary` (agregation).
 */
dataExchangeRouter.get("/campaigns/:campaignId/export", async (request, response, next) => {
  try {
    const auth = requireAuth(request);

    const campaign = await prisma.campaign.findUnique({
      where: { id: request.params.campaignId },
      include: {
        members: { include: { user: { select: { id: true, username: true } } } },
        characterSheets: true,
        sceneElements: true,
        inventoryEntries: { include: { item: { select: { slug: true } } } }
      }
    });

    if (!campaign) throw new HttpError(404, "Partie introuvable");
    if (campaign.gmUserId !== auth.user.id) {
      throw new HttpError(403, "Seul le MJ peut exporter la campagne");
    }

    // Table de correspondance userId -> reference exportee (pas d'ID interne dans le fichier).
    const memberRefByUserId = new Map<string, number>();
    const members = campaign.members.map((member, index) => {
      memberRefByUserId.set(member.userId, index);
      return { ref: index, username: member.user.username, role: member.role };
    });

    const characters = campaign.characterSheets.map((sheet) => ({
      memberRef: memberRefByUserId.get(sheet.userId) ?? null,
      charId: sheet.charId,
      charName: sheet.charName,
      hp: sheet.hp,
      maxHp: sheet.maxHp,
      attack: sheet.attack,
      defense: sheet.defense,
      speed: sheet.speed,
      magic: sheet.magic,
      level: sheet.level
    }));

    const sceneElements = campaign.sceneElements.map((element) => ({
      type: element.type,
      name: element.name,
      description: element.description,
      quantity: element.quantity,
      isVisible: element.isVisible,
      hp: element.hp,
      maxHp: element.maxHp,
      attack: element.attack,
      defense: element.defense,
      posX: element.posX,
      posY: element.posY,
      scale: element.scale
    }));

    const inventory = campaign.inventoryEntries.map((entry) => ({
      memberRef: memberRefByUserId.get(entry.userId) ?? null,
      itemSlug: entry.item.slug,
      quantity: entry.quantity,
      equipped: entry.equipped,
      bonusMaxHp: entry.bonusMaxHp,
      bonusAttack: entry.bonusAttack,
      bonusDefense: entry.bonusDefense,
      bonusSpeed: entry.bonusSpeed,
      bonusMagic: entry.bonusMagic,
      effectHp: entry.effectHp
    }));

    // Donnees consolidees / agregees (produites a l'export, absentes du modele).
    const totalHp = characters.reduce((sum, character) => sum + character.hp, 0);
    const summary = {
      memberCount: members.length,
      characterCount: characters.length,
      sceneElementCount: sceneElements.length,
      inventoryItemCount: inventory.reduce((sum, entry) => sum + entry.quantity, 0),
      averageHp: characters.length ? Math.round(totalHp / characters.length) : 0
    };

    const document = {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      campaign: {
        title: campaign.title,
        status: campaign.status,
        scenePreset: campaign.scenePreset,
        sceneTitle: campaign.sceneTitle,
        sceneText: campaign.sceneText
      },
      members,
      characters,
      sceneElements,
      inventory,
      summary
    };

    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="campagne-${campaign.id}.json"`
    );
    response.json(document);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /campaigns/import — importe un squelette de campagne depuis un fichier exporte.
 *
 * Choix de mapping (documente) : on importe la meta de campagne et les elements de scene
 * (donnees non nominatives). Les personnages et inventaires sont lies a des joueurs reels
 * absents du systeme cible : on ne les recree pas (evite des references orphelines et respecte
 * le RGPD). L'import cree une nouvelle campagne DONT L'IMPORTATEUR EST LE MJ.
 */
dataExchangeRouter.post("/campaigns/import", async (request, response, next) => {
  try {
    const auth = requireAuth(request);
    const body = request.body as Record<string, unknown>;

    if (body.format !== EXPORT_FORMAT) {
      throw new HttpError(400, "Format de fichier non reconnu");
    }
    if (body.version !== EXPORT_VERSION) {
      throw new HttpError(400, "Version de format non supportee");
    }

    const campaignInput = (body.campaign ?? {}) as Record<string, unknown>;
    const title = assertString(campaignInput.title, "campaign.title", 200);
    const scenePreset = optionalString(campaignInput.scenePreset) ?? "RUINS";
    const sceneTitle = optionalString(campaignInput.sceneTitle) ?? "Les ruines sous la pluie";
    const sceneText = optionalString(campaignInput.sceneText) ?? "";

    const rawElements = body.sceneElements ? requireArray(body.sceneElements, "sceneElements") : [];
    const sceneElements = rawElements.slice(0, 200).map((raw) => {
      const element = (raw ?? {}) as Record<string, unknown>;
      const type = assertString(element.type, "sceneElement.type", 20);
      if (!Object.values(SceneElementType).includes(type as SceneElementType)) {
        throw new HttpError(400, "Type d'element de scene invalide");
      }
      return {
        type: type as SceneElementType,
        name: assertString(element.name, "sceneElement.name", 200),
        description: optionalString(element.description) ?? "",
        quantity: Math.max(1, Math.min(20, Math.floor(Number(element.quantity ?? 1)) || 1)),
        isVisible: element.isVisible !== false,
        hp: Math.max(0, Math.floor(Number(element.hp ?? 0)) || 0),
        maxHp: Math.max(0, Math.floor(Number(element.maxHp ?? 0)) || 0)
      };
    });

    const joinCode = await createUniqueJoinCode();

    const created = await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          gmUserId: auth.user.id,
          title,
          joinCode,
          status: "DRAFT",
          scenePreset,
          sceneTitle,
          sceneText,
          members: { create: { userId: auth.user.id, role: MemberRole.GM } }
        }
      });

      if (sceneElements.length) {
        await tx.sceneElement.createMany({
          data: sceneElements.map((element) => ({ ...element, campaignId: campaign.id }))
        });
      }

      return campaign;
    });

    response.status(201).json({
      campaign: {
        id: created.id,
        title: created.title,
        joinCode: created.joinCode,
        status: created.status
      },
      imported: { sceneElements: sceneElements.length }
    });
  } catch (error) {
    next(error);
  }
});
