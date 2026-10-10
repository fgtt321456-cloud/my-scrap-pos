#!/usr/bin/env python3
"""Build RailTrack into a single self-contained railway/index.html.

Usage:  python3 railway/build.py          (writes railway/index.html and railway/build/game.js for `node --check`)
Source modules live in railway/src and are concatenated in the order below inside one IIFE.
"""
import os, re
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
R = lambda f: open(os.path.join(SRC, f), encoding='utf-8').read()

CSS = ['base.css', 'hlp.css', 'meta.css', 'station_ui.css']
HTML = ['body.html', 'meta.html']
# script order matters: later modules use globals defined earlier at runtime
JS = ['core_net.js', 'fx.js', 'ui_net.js', 'ux.js', 'timetable.js', 'rolling_stock.js', 'meta.js', 'difficulty.js', 'hlp_ui.js',
      'stations_data.js', 'stations.js', 'world.js', 'station_view.js', 'hlp_engine.js', 'hlp_fx.js', 'hlp_scenery.js', 'coop.js', 'perf.js', 'export.js', 'boot.js']
THREE_EX = ['shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js',
            'postprocessing/ShaderPass.js', 'postprocessing/UnrealBloomPass.js', 'geometries/RoundedBoxGeometry.js']
HEAD = '''<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>RailTrack Thailand</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap">
<style>
'''

def build():
    geo = open(os.path.join(ROOT, 'data', 'geo_data.json'), encoding='utf-8').read()
    js = ''.join(R(f) + ('\n' if not R(f).endswith('\n') else '') for f in JS)
    # the real-geography data is injected right after 'use strict' so every module can use it
    js = js.replace("'use strict';\n", "'use strict';\nconst GEO = " + geo + ";\n" + R('geo.js'), 1)
    out = (HEAD + ''.join(R(f) for f in CSS) + '</style>\n</head>\n<body>\n' + ''.join(R(f) for f in HTML) +
           '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n' +
           ''.join('<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/%s"></script>\n' % f for f in THREE_EX) +
           '<script>\n' + js + '</script>\n</body>\n</html>\n')
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(out)
    os.makedirs(os.path.join(ROOT, 'build'), exist_ok=True)
    open(os.path.join(ROOT, 'build', 'game.js'), 'w', encoding='utf-8').write(js)
    print('built railway/index.html', len(out), 'bytes')

if __name__ == '__main__':
    build()
