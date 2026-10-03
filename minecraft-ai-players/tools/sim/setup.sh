#!/bin/sh
# Headless simulator: runs the real AI scripts against a mocked @minecraft/server voxel world.
#   ./setup.sh                                   (re-run after changing BP/scripts)
#   node run.mjs min=20 mode=beat_game seed=3    (20 in-game minutes, prints tasks + inventory)
#   node endgame.mjs extra=dragon                (stronghold -> End -> dragon with a starter kit)
set -e
cd "$(dirname "$0")"
rm -rf scripts && cp -r ../../BP/scripts scripts
mkdir -p node_modules/@minecraft/server node_modules/@minecraft/server-ui
echo '{"name":"@minecraft/server","type":"module","main":"index.js"}' > node_modules/@minecraft/server/package.json
echo 'export * from "../../../mock/server.js";' > node_modules/@minecraft/server/index.js
echo '{"name":"@minecraft/server-ui","type":"module","main":"index.js"}' > node_modules/@minecraft/server-ui/package.json
echo 'export * from "../../../mock/server-ui.js";' > node_modules/@minecraft/server-ui/index.js
echo '{"type":"module"}' > package.json
echo "simulator ready"
