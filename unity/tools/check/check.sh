#!/bin/sh
# Compile every Unity script against a minimal UnityEngine stub and run the data/simulation checks against
# Assets/StreamingAssets/RailTrack, without opening Unity. Needs mono (mcs + mono).
# Run from the repo root: sh unity/tools/check/check.sh
set -e
# optional: DUMP=<dir> also writes the generated station meshes for render_scenery.js
U=$(cd "$(dirname "$0")/../.." && pwd); OUT=${TMPDIR:-/tmp}/railtrack-check; mkdir -p "$OUT"
mcs -langversion:7.2 -nowarn:649,169,414 -target:library -out:"$OUT/all.dll" "$U/tools/check/UnityStub.cs" "$U/tools/check/UnityStubJson.cs" $(find "$U/Assets/Scripts" -name '*.cs')
mcs -langversion:7.2 -nowarn:649,169,414 -out:"$OUT/check.exe" "$U/tools/check/UnityStub.cs" "$U/tools/check/UnityStubJson.cs" "$U/tools/check/DataCheck.cs" "$U/tools/check/StationSimCheck.cs" "$U/tools/check/SceneryCheck.cs" "$U/tools/check/TrainCheck.cs" "$U/Assets/Scripts/Trains/TrainLibrary.cs" $(find "$U/Assets/Scripts/Data" "$U/Assets/Scripts/Simulation" -name '*.cs') "$U/Assets/Scripts/Scenery/MeshData.cs" "$U/Assets/Scripts/Scenery/StationSceneModel.cs" "$U/Assets/Scripts/Scenery/TrainMeshModel.cs" "$U/Assets/Scripts/Stations/IStationAdapter.cs" "$U/Assets/Scripts/Stations/TimetableStationAdapter.cs"
mono "$OUT/check.exe" "$U/Assets/StreamingAssets/RailTrack" "$U/tools/check" $DUMP
