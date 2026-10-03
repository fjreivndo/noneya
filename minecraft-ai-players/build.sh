#!/bin/sh
# Builds dist/AIPlayers_v<version>.mcaddon (double-click to import into Minecraft Bedrock).
# The version comes from BP/manifest.json.
set -e
cd "$(dirname "$0")"
V=$(python3 -c "import json;print('.'.join(map(str,json.load(open('BP/manifest.json'))['header']['version'])))")
CV=$(python3 -c "import json;print('.'.join(map(str,json.load(open('chatpack/manifest.json'))['header']['version'])))")
rm -rf dist && mkdir -p dist/tmp
cp -r BP "dist/tmp/AI Players BP"
cp -r RP "dist/tmp/AI Players RP"
( cd dist/tmp && zip -qr ../AIPlayers_v$V.mcaddon "AI Players BP" "AI Players RP" )
( cd "dist/tmp/AI Players BP" && zip -qr ../../AIPlayers_BP_v$V.mcpack . )
( cd "dist/tmp/AI Players RP" && zip -qr ../../AIPlayers_RP_v$V.mcpack . )
( cd bridge && zip -qr ../dist/AIPlayers_LLM_Bridge_BDS_v$V.mcpack . )
( cd chatpack && zip -qr ../dist/AIPlayers_Chat_BetaAPIs_v$CV.mcpack . )
rm -rf dist/tmp
ls -la dist
