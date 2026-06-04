#!/bin/bash
set -e

echo ""
echo "========================================"
echo "  Grimoire — Setup du container"
echo "========================================"

echo ""
echo "[1/4] Installation des dépendances..."
npm install

echo ""
echo "[2/4] En attente de PostgreSQL..."
until bash -c 'echo > /dev/tcp/postgres/5432' 2>/dev/null; do
  printf '.'
  sleep 2
done
echo " OK"

echo ""
echo "[3/4] Génération du client Prisma..."
npm run prisma:generate

echo ""
echo "[4/4] Application des migrations en attente..."
npm run prisma:deploy

echo ""
echo "========================================"
echo "  Prêt ! Lance le projet avec :"
echo "  npm run dev:server"
echo "  npm run dev:web"
echo "========================================"
echo ""
