#!/bin/bash
cd "$(dirname "$0")" || exit 1
git add -A
git commit -m "Fix: remove unused imports and rebrand to Bystock"
git push
echo "✅ Push completed successfully!"
