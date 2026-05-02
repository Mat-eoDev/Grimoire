import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const builtinImages = [
  {
    name: "Crypte aux chandelles",
    imageDataUrl: svgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1f1510" />
            <stop offset="100%" stop-color="#5f3721" />
          </linearGradient>
        </defs>
        <rect width="1200" height="700" fill="url(#bg)" />
        <circle cx="170" cy="130" r="110" fill="#f7c56e" opacity="0.22" />
        <circle cx="1030" cy="120" r="90" fill="#f8a95c" opacity="0.14" />
        <path d="M70 630 Q240 410 420 560 T780 540 T1130 610 L1130 700 L70 700 Z" fill="#24160f" opacity="0.86" />
        <rect x="212" y="300" width="36" height="180" rx="18" fill="#e8d2a0" opacity="0.84" />
        <rect x="592" y="340" width="36" height="160" rx="18" fill="#e8d2a0" opacity="0.84" />
        <rect x="932" y="286" width="36" height="196" rx="18" fill="#e8d2a0" opacity="0.84" />
        <ellipse cx="230" cy="302" rx="42" ry="56" fill="#ffbe62" opacity="0.46" />
        <ellipse cx="610" cy="342" rx="42" ry="56" fill="#ffbe62" opacity="0.38" />
        <ellipse cx="950" cy="286" rx="42" ry="56" fill="#ffbe62" opacity="0.48" />
      </svg>
    `)
  },
  {
    name: "Foret brumeuse",
    imageDataUrl: svgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#29484f" />
            <stop offset="100%" stop-color="#789486" />
          </linearGradient>
        </defs>
        <rect width="1200" height="700" fill="url(#sky)" />
        <circle cx="920" cy="120" r="82" fill="#cce4d2" opacity="0.35" />
        <g fill="#183127">
          <path d="M90 700 L190 220 L290 700 Z" />
          <path d="M250 700 L350 180 L450 700 Z" />
          <path d="M520 700 L620 150 L720 700 Z" />
          <path d="M770 700 L870 210 L970 700 Z" />
          <path d="M960 700 L1060 170 L1160 700 Z" />
        </g>
        <rect y="530" width="1200" height="170" fill="#12231f" opacity="0.8" />
        <ellipse cx="350" cy="560" rx="360" ry="70" fill="#d7efe0" opacity="0.18" />
        <ellipse cx="820" cy="510" rx="430" ry="72" fill="#d7efe0" opacity="0.14" />
      </svg>
    `)
  },
  {
    name: "Salle du trone",
    imageDataUrl: svgDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700">
        <defs>
          <linearGradient id="hall" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#271711" />
            <stop offset="100%" stop-color="#6f4730" />
          </linearGradient>
        </defs>
        <rect width="1200" height="700" fill="url(#hall)" />
        <path d="M0 700 L230 130 L420 130 L320 700 Z" fill="#3c271c" opacity="0.92" />
        <path d="M1200 700 L970 130 L780 130 L880 700 Z" fill="#3c271c" opacity="0.92" />
        <rect x="496" y="150" width="208" height="318" rx="28" fill="#8b5b3d" />
        <rect x="538" y="230" width="124" height="176" rx="18" fill="#d7a25d" />
        <rect y="560" width="1200" height="140" fill="#24160f" opacity="0.8" />
        <circle cx="134" cy="154" r="34" fill="#ffc773" opacity="0.35" />
        <circle cx="1066" cy="154" r="34" fill="#ffc773" opacity="0.35" />
      </svg>
    `)
  }
];

async function main() {
  for (const image of builtinImages) {
    const existing = await prisma.contextImage.findFirst({
      where: {
        name: image.name,
        isBuiltin: true
      }
    });

    if (existing) {
      await prisma.contextImage.update({
        where: { id: existing.id },
        data: {
          imageDataUrl: image.imageDataUrl
        }
      });
      continue;
    }

    await prisma.contextImage.create({
      data: {
        ...image,
        isBuiltin: true
      }
    });
  }

  console.log(`Seed: ${builtinImages.length} image(s) de contexte ajoutee(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
