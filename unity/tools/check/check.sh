#!/bin/sh
# Compile every Unity script against a minimal UnityEngine stub and run the data/simulation checks against
# Assets/StreamingAssets/RailTrack, without opening Unity. Needs mono (mcs + mono).
# Run from the repo root: sh unity/tools/check/check.sh
set -e
U=$(cd "$(dirname "$0")/../.." && pwd); OUT=${TMPDIR:-/tmp}/railtrack-check; mkdir -p "$OUT"
mcs -langversion:7.2 -nowarn:649,169,414 -target:library -out:"$OUT/all.dll" "$U/tools/check/UnityStub.cs" "$U/tools/check/UnityStubJson.cs" $(find "$U/Assets/Scripts" -name '*.cs')
mcs -langversion:7.2 -nowarn:649,169,414 -out:"$OUT/check.exe" "$U/tools/check/UnityStub.cs" "$U/tools/check/UnityStubJson.cs" "$U/tools/check/DataCheck.cs" $(find "$U/Assets/Scripts/Data" "$U/Assets/Scripts/Simulation" -name '*.cs') "$U/Assets/Scripts/Stations/IStationAdapter.cs"
mono "$OUT/check.exe" "$U/Assets/StreamingAssets/RailTrack"
