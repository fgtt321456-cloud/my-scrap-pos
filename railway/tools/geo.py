"""Build railway/data/geo_data.json from Natural Earth 1:10m data.

Download into railway/tools/naturalearth/:
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_railroads.geojson  (save as rail.geojson)
Then: pip install shapely && python3 railway/tools/geo.py railway/tools/stations.json
"""
import json, math, heapq, sys, os
from shapely.geometry import shape, Point, LineString, mapping
from shapely.ops import unary_union
HERE=os.path.dirname(os.path.abspath(__file__))
G=os.path.join(HERE,'naturalearth')+'/'
LON0, LAT0 = 100.5170, 13.7392
KX, KZ = 111.32*math.cos(math.radians(13.5)), 110.57
UNIT = 6.0
def P(lon, lat): return (round((lon-LON0)*KX/UNIT, 2), round(-(lat-LAT0)*KZ/UNIT, 2))
C=json.load(open(G+'ne_10m_admin_0_countries.geojson'))
geoms={f['properties']['ADMIN']: shape(f['geometry']) for f in C['features']}
TH=geoms['Thailand']
NB=['Myanmar','Laos','Cambodia','Malaysia','Vietnam']
bbox=shape({'type':'Polygon','coordinates':[[[96.0,4.5],[107.5,4.5],[107.5,21.5],[96.0,21.5],[96.0,4.5]]]})
def polys(g, tol):
    g=g.simplify(tol, preserve_topology=True)
    out=[]
    for p in (g.geoms if g.geom_type=='MultiPolygon' else [g]):
        if p.area < 0.002: continue
        out.append([list(P(x,y)) for x,y in p.exterior.coords])
    return out
th=polys(TH, 0.01)
nb={n: polys(geoms[n].intersection(bbox), 0.03) for n in NB}
# rail
R=json.load(open(G+'rail.geojson'))
THb=TH.buffer(0.03)
lines=[]
for f in R['features']:
    g=shape(f['geometry'])
    for l in (g.geoms if g.geom_type=='MultiLineString' else [g]):
        if not l.intersects(THb): continue
        c=l.intersection(THb)
        for ll in (c.geoms if hasattr(c,'geoms') else [c]):
            if ll.geom_type!='LineString' or ll.length<0.002: continue
            lines.append(ll.simplify(0.004))
lines.append(LineString([(101.040,13.697),(101.000,13.560),(100.990,13.360),(100.935,13.170),(100.905,13.086),(100.905,12.925),(100.930,12.700)]))
print('rail lines', len(lines), file=sys.stderr)
# graph
key=lambda x,y:(round(x/0.003), round(y/0.003))
nodes={}; coords=[]; adj={}
def nid(x,y):
    k=key(x,y)
    if k not in nodes: nodes[k]=len(coords); coords.append((x,y)); adj[nodes[k]]=set()
    return nodes[k]
for l in lines:
    pts=list(l.coords); prev=None
    for x,y in pts:
        n=nid(x,y)
        if prev is not None and prev!=n: adj[prev].add(n); adj[n].add(prev)
        prev=n
def km(a,b):
    (x1,y1),(x2,y2)=coords[a],coords[b]
    return math.hypot((x1-x2)*KX*math.cos(math.radians((y1+y2)/2))/math.cos(math.radians(13.5)), (y1-y2)*KZ)
# stitch small gaps between components (data breaks / manual branches)
def comps():
    seen={}; cid=0
    for s in adj:
        if s in seen: continue
        st=[s]; seen[s]=cid
        while st:
            u=st.pop()
            for v in adj[u]:
                if v not in seen: seen[v]=cid; st.append(v)
        cid+=1
    return seen
for it in range(40):
    cm=comps(); groups={}
    for n,c in cm.items(): groups.setdefault(c,[]).append(n)
    if len(groups)==1: break
    big=max(groups.values(), key=len); bs=set(big); merged=False
    for c,ns in groups.items():
        if ns is big: continue
        best=None
        for a in ns:
            for b in big:
                d=km(a,b)
                if best is None or d<best[0]: best=(d,a,b)
        if best[0]<4: adj[best[1]].add(best[2]); adj[best[2]].add(best[1]); merged=True
    if not merged: break
ST=json.load(open(sys.argv[1]))
snap={}
for s in ST:
    best=min(range(len(coords)), key=lambda i: (coords[i][0]-s['lon'])**2+(coords[i][1]-s['lat'])**2)
    d=math.hypot((coords[best][0]-s['lon'])*KX,(coords[best][1]-s['lat'])*KZ)
    snap[s['id']]=best
    print(s['id'], 'snap km %.1f'%d, file=sys.stderr)
    if d>1.0:
        n=len(coords); coords.append((s['lon'],s['lat'])); adj[n]={best}; adj[best].add(n); snap[s['id']]=n
def dij(a):
    D={a:0}; pq=[(0,a)]
    while pq:
        d,u=heapq.heappop(pq)
        if d>D[u]: continue
        for v in adj[u]:
            nd=d+km(u,v)
            if nd<D.get(v,1e18): D[v]=nd; heapq.heappush(pq,(nd,v))
    return D
D=dij(snap['BKK'])
for s in ST: print(s['id'], 'km from BKK', round(D.get(snap[s['id']],-1)), file=sys.stderr)
# compact graph: keep nodes, write edges
used=sorted(adj.keys())
out={'th':th,'nb':nb,'rn':[list(P(*coords[i])) for i in range(len(coords))],'re':sorted({(min(a,b),max(a,b)) for a in adj for b in adj[a]}),
     'snap':snap,'st':{s['id']:list(P(s['lon'],s['lat'])) for s in ST}}
out['re']=[list(e) for e in out['re']]
open(os.path.join(HERE,'..','data','geo_data.json'),'w').write(json.dumps(out,separators=(',',':')))
print('nodes',len(coords),'edges',len(out['re']), file=sys.stderr)
