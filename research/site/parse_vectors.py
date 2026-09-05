"""Read the simple 2D entities actually returned by the municipal WMS DXF export."""
import json, math, pathlib, re
from pyproj import Transformer

ROOT = pathlib.Path(__file__).parent
def read_dxf(filename):
    lines = (ROOT / 'raw' / filename).read_text().splitlines()
    pairs = [(int(lines[i]), lines[i+1].strip()) for i in range(0,len(lines)-1,2)]
    entities = []
    current = None
    for code,value in pairs:
        if code == 0:
            if current: entities.append(current)
            current = {'type':value,'codes':[]} if value in ('LWPOLYLINE','POINT') else None
        elif current: current['codes'].append((code,value))
    if current: entities.append(current)
    result = []
    for entity in entities:
        vertices = []
        layer = None
        for code,value in entity['codes']:
            if code == 8: layer = value
            if code == 10: vertices.append([float(value)])
            if code == 20: vertices[-1].append(float(value))
        result.append({'type':entity['type'], 'layer':layer, 'coordinates':vertices})
    return result

if __name__ == '__main__':
    transformer = Transformer.from_crs(3011,4326,always_xy=True)
    rawparcel = json.loads((ROOT/'raw/parcel-point.json').read_text())[0]
    coords = [[float(x),float(y)] for x,y in re.findall(r'(\d+\.\d+) (\d+\.\d+)',rawparcel['shape_wkt'])]
    origin = coords[0]
    shifted = [[x-origin[0],y-origin[1]] for x,y in coords]
    area = abs(sum(x*v-y*u for (x,y),(u,v) in zip(shifted,shifted[1:])))/2
    parcel = {'type':'Feature','geometry':{'type':'Polygon','coordinates':[coords]},'properties':{'name':'VIKSJÖ 2:573','crs':'EPSG:3011','areaM2':area,'source':'Municipal public map ds_fastytor','sourceRaw':'raw/parcel-point.json','boundaryAccuracy':'Municipal map geometry; not a cadastral boundary determination','coordinatesWgs84':[[*transformer.transform(x,y)]for x,y in coords]}}
    (ROOT/'parcel.json').write_text(json.dumps(parcel,ensure_ascii=False,indent=2))
    for name in ['building','heights','contours','halfcontours']:
        entities = read_dxf(name+'.dxf')
        (ROOT/(name+'-vectors.json')).write_text(json.dumps({'crs':'EPSG:3011','sourceRaw':'raw/'+name+'.dxf','entities':entities},ensure_ascii=False,indent=2))
        print(name,len(entities),'vertices',sum(len(e['coordinates'])for e in entities))
    print('parcel area',area)
