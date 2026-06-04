import { PrismaClient } from "@prisma/client";
import { readdir } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();

const imageFolders = [
  { folder: "pnj", type: "NPC" },
  { folder: "npc", type: "NPC" },
  { folder: "enemy", type: "ENEMY" },
  { folder: "ennemi", type: "ENEMY" },
  { folder: "object", type: "OBJECT" },
  { folder: "objet", type: "OBJECT" }
] as const;

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function toAssetName(filename: string) {
  return parse(filename).name.replace(/[_-]+/g, " ").trim();
}

async function main() {
  const prismaDir = dirname(fileURLToPath(import.meta.url));
  const libraryDir = join(prismaDir, "../../web/public/lib_picture");
  let syncedAssets = 0;

  for (const { folder, type } of imageFolders) {
    const folderPath = join(libraryDir, folder);
    let files: string[];

    try {
      files = await readdir(folderPath);
    } catch {
      continue;
    }

    for (const file of files) {
      const extension = parse(file).ext.toLowerCase();
      if (!imageExtensions.has(extension)) continue;

      const name = toAssetName(file);
      const imageDataUrl = `/lib_picture/${folder}/${file}`;
      const existing = await prisma.revelationAsset.findFirst({
        where: { type, name }
      });

      if (existing) {
        await prisma.revelationAsset.update({
          where: { id: existing.id },
          data: { imageDataUrl }
        });
      } else {
        await prisma.revelationAsset.create({
          data: { type, name, imageDataUrl }
        });
      }

      syncedAssets += 1;
    }
  }

  console.log(`Seed: ${syncedAssets} image(s) de bibliotheque synchronisee(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
