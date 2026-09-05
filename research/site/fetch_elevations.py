"""Match published WMS contour/point attributes to their public DXF coordinates."""
import concurrent.futures, json, pathlib, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).parent
RAW = ROOT / 'raw'
BASE = json.loads((RAW/'baskarta-request.json').read_text())['url'].split('&SERVICE=')[0]
OUT = RAW / 'elevation-attributes'
OUT.mkdir(exist_ok=True)

def query(kind, index, entity):
    coords = entity['coordinates']
    layer = 'td22.2_publ_ho_hojddjuppunkt_p' if kind == 'height' else 'td22.2_publ_hk_hojddjupkurva_1m_upp_l'
    # A tiny map pixel ensures each call targets a known exported vertex, not an arbitrary nearby line.
    for attempt,vertex_index in enumerate([len(coords)//2, len(coords)//3, 0]):
        x,y = coords[vertex_index]
        params = {'SERVICE':'WMS','REQUEST':'GetFeatureInfo','VERSION':'1.1.1','SRS':'EPSG:3011',
            'LAYERS':layer,'QUERY_LAYERS':layer,'BBOX':f'{x-10},{y-10},{x+10},{y+10}',
            'WIDTH':1000,'HEIGHT':1000,'X':500,'Y':500,'FEATURE_COUNT':10,'INFO_FORMAT':'application/geo+json'}
        url = BASE + '&' + urllib.parse.urlencode(params)
        response = urllib.request.urlopen(url,timeout=35).read()
        rawfile = OUT/f'{kind}-{index:03d}-{attempt}.json'
        rawfile.write_bytes(response)
        features = json.loads(response).get('features',[])
        if len(features) == 1:
            f = features[0]
            p = f['properties']
            height = p.get('Höjd/Djup värde',p.get('Höjd/Djup-värde'))
            if height is not None:
                result = {'coordinates':coords,'elevation':height,'featureId':f['id'],
                    'sourceRaw':str(rawfile.relative_to(ROOT)), 'matchedQueryVertex':[x,y],
                    'heightUncertaintyM':p.get('Lägesosäkerhet höjd'),
                    'acquisitionDate':p.get('Insamlingsdatum',p.get('Insamling slutförd'))}
                if kind == 'height':result |= {'E':coords[0][0],'N':coords[0][1]}
                return kind,index,result
        if len(coords)==1:break
    return kind,index,{'coordinates':coords,'elevation':None,'status':'unmatched','sourceRaw':str(rawfile.relative_to(ROOT))}

if __name__ == '__main__':
    items=[]
    for kind,name in [('contour','contours'),('height','heights')]:
        for index,entity in enumerate(json.loads((ROOT/(name+'-vectors.json')).read_text())['entities']):
            items.append((kind,index,entity))
    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures=[pool.submit(query,*item)for item in items]
        for future in concurrent.futures.as_completed(futures):
            result=future.result();results.append(result)
            print(result[0],result[1],result[2]['elevation'],flush=True)
    results.sort(key=lambda x:(x[0],x[1]))
    document={'crs':'EPSG:3011','verticalDatum':'RH2000','geoidModel':'SWEN17_RH2000',
        'source':'Järfälla municipal public Baskarta WMS DXF linework and GetFeatureInfo height attributes',
        'sourceMap':'https://jarfallakartan.jarfalla.se/spatialmap?profile=jarfallakartan',
        'bbox':[138650,6589520,138780,6589640],
        'method':'Each exported DXF polyline matched at an exact vertex to a unique public WMS feature with its height attribute. The 2D DXF itself has zero Z; heights come from feature attributes. Terrain interpolation is a separate model operation.',
        'contours':[v for k,i,v in results if k=='contour'],
        'spotHeights':[v for k,i,v in results if k=='height']}
    (ROOT/'elevation-evidence.json').write_text(json.dumps(document,ensure_ascii=False,indent=2))
    print('DONE',len(results),'unmatched',sum(v['elevation'] is None for _,_,v in results),flush=True)
