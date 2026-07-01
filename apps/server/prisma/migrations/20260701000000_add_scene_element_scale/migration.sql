-- Ajoute une échelle (taille) aux éléments de scène, pilotable par le MJ.
ALTER TABLE "SceneElement" ADD COLUMN "scale" DOUBLE PRECISION NOT NULL DEFAULT 1;
