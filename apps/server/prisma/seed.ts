import { PrismaClient, ActorType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const races = [
    {
      code: "humain",
      name: "Humain",
      description: "Polyvalent et adaptable."
    },
    {
      code: "elfe",
      name: "Elfe",
      description: "Fin, agile et lie a la magie."
    },
    {
      code: "nain",
      name: "Nain",
      description: "Solide, endurant et determine."
    },
    {
      code: "orc",
      name: "Orc",
      description: "Puissant et imposant."
    }
  ];

  for (const race of races) {
    await prisma.race.upsert({
      where: { code: race.code },
      update: race,
      create: race
    });
  }

  const classes = [
    {
      code: "guerrier",
      name: "Guerrier",
      description: "Specialiste du corps a corps."
    },
    {
      code: "rodeur",
      name: "Rodeur",
      description: "Eclaireur et combattant mobile."
    },
    {
      code: "mage",
      name: "Mage",
      description: "Manie les energies mystiques."
    },
    {
      code: "clerc",
      name: "Clerc",
      description: "Soutien, protection et soin."
    }
  ];

  for (const characterClass of classes) {
    await prisma.characterClass.upsert({
      where: { code: characterClass.code },
      update: characterClass,
      create: characterClass
    });
  }

  const templates = [
    {
      name: "Villageois inquiet",
      actorType: ActorType.NPC,
      level: 1,
      hpMax: 8,
      summary: "PNJ simple pour une scene d'introduction."
    },
    {
      name: "Marchand ambulant",
      actorType: ActorType.NPC,
      level: 1,
      hpMax: 10,
      summary: "PNJ social pour donner du contexte ou une quete."
    },
    {
      name: "Gobelin",
      actorType: ActorType.MONSTER,
      level: 1,
      hpMax: 12,
      summary: "Adversaire faible pour un premier combat."
    },
    {
      name: "Loup des collines",
      actorType: ActorType.MONSTER,
      level: 1,
      hpMax: 14,
      summary: "Monstre bestial rapide."
    },
    {
      name: "Squelette errant",
      actorType: ActorType.MONSTER,
      level: 2,
      hpMax: 18,
      summary: "Ennemi resilient pour une crypte ou une grotte."
    }
  ];

  for (const template of templates) {
    await prisma.actorTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
