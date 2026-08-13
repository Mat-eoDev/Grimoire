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
  { folder: "objet", type: "OBJECT" },
  { folder: "player", type: "PLAYER" }
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

  const items = [
    { slug: "epee1",         name: "Épée",             type: "WEAPON",     imageFile: "epee1.webp",       description: "Une épée à une main, solide et fiable.", equipable: true },
    { slug: "dague",         name: "Dague",            type: "WEAPON",     imageFile: "dague.webp",       description: "Légère et rapide, idéale pour les frappes furtives.", equipable: true },
    { slug: "lance",         name: "Lance",            type: "WEAPON",     imageFile: "lance.webp",       description: "Une arme d'hast à longue portée.", equipable: true },
    { slug: "arc1",          name: "Arc",              type: "WEAPON",     imageFile: "arc1.webp",        description: "Un arc pour attaquer à distance.", equipable: true },
    { slug: "arcnbois",      name: "Arc en bois",      type: "WEAPON",     imageFile: "arcnbois.webp",    description: "Un arc simple taillé dans du bois.", equipable: true },
    { slug: "batonmagicien", name: "Bâton de magicien", type: "WEAPON",   imageFile: "batonmagicien.webp", description: "Canalise la magie de son porteur.", equipable: true },
    { slug: "bouclier1",     name: "Bouclier",         type: "SHIELD",     imageFile: "bouclier1.webp",   description: "Un bouclier en bois renforcé.", equipable: true },
    { slug: "boucliermetal", name: "Bouclier en métal", type: "SHIELD",   imageFile: "boucliermetal.webp", description: "Lourd mais très résistant.", equipable: true },
    { slug: "potiondevie",   name: "Potion de vie",    type: "CONSUMABLE", imageFile: "potiondevie.webp", description: "Restaure des points de vie.", equipable: false },
    { slug: "mana",          name: "Potion de mana",   type: "CONSUMABLE", imageFile: "mana.webp",        description: "Restaure des points de magie.", equipable: false },
    { slug: "poison",        name: "Poison",           type: "CONSUMABLE", imageFile: "poison.webp",      description: "Un liquide sombre aux effets dévastateurs.", equipable: false },
    { slug: "fleche",        name: "Flèche",           type: "MISC",       imageFile: "fleche.webp",      description: "Une flèche, à utiliser avec un arc.", equipable: false },
    { slug: "caillou",       name: "Caillou",          type: "MISC",       imageFile: "caillou.webp",     description: "Un simple caillou. Sait-on jamais.", equipable: false },
  ] as const;

  let syncedItems = 0;
  for (const item of items) {
    await prisma.item.upsert({
      where: { slug: item.slug },
      update: { name: item.name, type: item.type, imageFile: item.imageFile, description: item.description, equipable: item.equipable },
      create: item,
    });
    syncedItems += 1;
  }
  console.log(`Seed: ${syncedItems} item(s) synchronise(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
