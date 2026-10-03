#!/bin/sh
# Builds dist/AIPlayers.mcaddon (double-click to import into Minecraft Bedrock).
set -e
cd "$(dirname "$0")"
rm -rf dist && mkdir -p dist/tmp
cp -r BP "dist/tmp/AI Players BP"
cp -r RP "dist/tmp/AI Players RP"
( cd dist/tmp && zip -qr ../AIPlayers.mcaddon "AI Players BP" "AI Players RP" )
( cd "dist/tmp/AI Players BP" && zip -qr ../../AIPlayers_BP.mcpack . )
( cd "dist/tmp/AI Players RP" && zip -qr ../../AIPlayers_RP.mcpack . )
( cd bridge && zip -qr ../dist/AIPlayers_LLM_Bridge_BDS.mcpack . )
( cd chatpack && zip -qr ../dist/AIPlayers_Chat_BetaAPIs.mcpack . )
rm -rf dist/tmp
ls -la dist
