#!/bin/bash
cd "$(dirname "$0")" || exit 1
git add -A
git commit -m "Aesthetic updates: three-theme system, remove Actas module, rename Paz Holding to Bienes y Activos"
git push
echo "✅ Push completed successfully!"
