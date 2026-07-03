-- Renforcement de l'integrite des donnees (competence C10 du referentiel).
-- Contraintes CHECK + trigger de garde, appliques au plus pres de la donnee :
-- l'invariant tient meme en cas d'ecriture directe en base, hors application.
--
-- Note : ces objets SQL bruts ne sont pas modelises dans schema.prisma (limitation Prisma).
-- Ils sont appliques par `prisma migrate deploy`. Les CHECK sont ajoutes en NOT VALID pour
-- ne jamais echouer sur d'eventuelles donnees preexistantes (ils s'appliquent aux ecritures).

-- 1) Contraintes CHECK (domaine des valeurs)
ALTER TABLE "CharacterSheet" ADD CONSTRAINT "chk_character_hp_nonneg" CHECK ("hp" >= 0) NOT VALID;
ALTER TABLE "CharacterSheet" ADD CONSTRAINT "chk_character_hp_le_max" CHECK ("hp" <= "maxHp") NOT VALID;
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "chk_inventory_qty_nonneg" CHECK ("quantity" >= 0) NOT VALID;
ALTER TABLE "SceneElement"   ADD CONSTRAINT "chk_scene_hp_nonneg"      CHECK ("hp" >= 0) NOT VALID;

-- 2) Trigger de garde : borne les PV d'une fiche dans [0, maxHp] avant chaque ecriture.
CREATE OR REPLACE FUNCTION character_sheet_hp_guard() RETURNS trigger AS $$
BEGIN
  IF NEW."maxHp" < 0 THEN NEW."maxHp" := 0; END IF;
  IF NEW."hp" < 0 THEN NEW."hp" := 0; END IF;
  IF NEW."hp" > NEW."maxHp" THEN NEW."hp" := NEW."maxHp"; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_character_sheet_hp_guard ON "CharacterSheet";
CREATE TRIGGER trg_character_sheet_hp_guard
  BEFORE INSERT OR UPDATE ON "CharacterSheet"
  FOR EACH ROW EXECUTE FUNCTION character_sheet_hp_guard();
