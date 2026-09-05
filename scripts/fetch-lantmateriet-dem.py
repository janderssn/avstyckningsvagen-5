#!/usr/bin/env python3
"""Download Lantmäteriet Markhöjdmodell for this site, then archive a small crop.

Follows fjall/tools/jord/jord/sources/dem.py's authenticated STAC workflow.
Credentials are read from LANTMATERIET_USERNAME/PASSWORD or --env-file and
are never written to artifacts. Only official Lantmäteriet hosts receive them.
"""
import argparse
import base64
import hashlib
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import requests
import rasterio
from dotenv import dotenv_values
from pyproj import Transformer
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'research/site/lantmateriet'
API = 'https://api.lantmateriet.se/stac-hojd/v1'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--env-file', type=Path)
parser.add_argument('--catalog-only', action='store_true')
args = parser.parse_args()
config = dotenv_values(args.env_file) if args.env_file else {}
username = os.getenv('LANTMATERIET_USERNAME') or config.get('LANTMATERIET_USERNAME')
password = os.getenv('LANTMATERIET_PASSWORD') or config.get('LANTMATERIET_PASSWORD')
if not username or not password:
    parser.error('Lantmäteriet credentials are missing; use environment variables or --env-file.')
session = requests.Session()
session.mount('https://', HTTPAdapter(max_retries=Retry(total=3, backoff_factor=0.6,
              status_forcelist=[429, 500, 502, 503, 504], allowed_methods=['GET', 'HEAD', 'POST'])))


def official(url):
    parsed = urlparse(url)
    return parsed.scheme == 'https' and (parsed.hostname or '').endswith('.lantmateriet.se') and not parsed.username


def request(method, url, **kwargs):
    if not official(url):
        raise ValueError('Refusing to send credentials to a non-Lantmäteriet host')
    response = session.request(method, url, auth=(username, password), timeout=(20, 90), **kwargs)
    response.raise_for_status()
    return response


def origin_ring_mask(xs, ys, ring):
    """Even/odd point-in-ring test; callers subtract interior rings."""
    inside = np.zeros(xs.shape, dtype=bool)
    for (x0, y0), (x1, y1) in zip(ring, ring[1:]):
        if y0 == y1:
            continue
        inside ^= ((y0 > ys) != (y1 > ys)) & (xs < (x1 - x0) * (ys - y0) / (y1 - y0) + x0)
    return inside


def acquisition_metadata(origin_documents, transform, width, height, check_points):
    """Derive local acquisition metadata from every output pixel center.

    Source raster XY is SWEREF99 TM (EPSG:3006 or its RH2000 compound CRS).
    Origin Polygon/MultiPolygon holes are excluded. Mixed or incomplete origin
    coverage remains explicit instead of assigning one tile-wide date to it.
    """
    rows, cols = np.meshgrid(np.arange(height), np.arange(width), indexing='ij')
    cols, rows = cols.ravel() + .5, rows.ravel() + .5
    xs = transform.c + cols * transform.a + rows * transform.b
    ys = transform.f + cols * transform.d + rows * transform.e
    pixel_count = xs.size
    xs = np.concatenate((xs, [p[0] for p in check_points]))
    ys = np.concatenate((ys, [p[1] for p in check_points]))
    matches = np.zeros(xs.size, dtype=np.uint16)
    origins = []
    for document in origin_documents:
        data = document['data']
        crs = data.get('crs', {}).get('properties', {}).get('name')
        if not crs or rasterio.crs.CRS.from_user_input(crs).to_epsg() not in (3006, 5845):
            raise ValueError('Origin metadata must declare SWEREF99 TM coordinates')
        for feature in data.get('features', []):
            geometry = feature.get('geometry') or {}
            if geometry.get('type') not in ('Polygon', 'MultiPolygon'):
                continue
            polygons = [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']
            mask = np.zeros(xs.size, dtype=bool)
            for polygon in polygons:
                part = origin_ring_mask(xs, ys, polygon[0])
                for hole in polygon[1:]:
                    part &= ~origin_ring_mask(xs, ys, hole)
                mask |= part
            if not mask.any():
                continue
            matches += mask
            props = feature.get('properties', {})
            origins.append({'date': props.get('matdatum'), 'method': props.get('lagesbestamningsmetod'),
                            'heightUncertaintyM': props.get('lagesosakerhethojd'),
                            'horizontalUncertaintyM': props.get('lagesosakerhetplan'),
                            'originPolygonId': str(feature.get('id')), 'originMetadataUrl': document['url'],
                            'matchedRasterPixelCount': int(mask[:pixel_count].sum()),
                            'matchedCheckPointCount': int(mask[pixel_count:].sum())})
    verified = bool((matches == 1).all())
    result = {'status': 'verified' if verified else 'incomplete-or-overlapping',
              'verification': ('All output pixel centers and house/parcel/context check points tested against '
                               'origin polygons, excluding interior rings.'),
              'verifiedRasterPixelCount': int((matches[:pixel_count] == 1).sum()),
              'rasterPixelCount': pixel_count, 'verifiedCheckPointCount': int((matches[pixel_count:] == 1).sum()),
              'checkPointCount': len(check_points)}
    if verified and len(origins) == 1:
        result.update({key: value for key, value in origins[0].items() if not key.startswith('matched')})
    else:
        result['origins'] = origins
        result['date'] = None
        result['method'] = None
    return result


DEST.mkdir(parents=True, exist_ok=True)
# Municipal source extent comfortably covers the rotated local terrain and
# gives additional pixels for bilinear sampling at all four context corners.
bbox3011 = [138650, 6589520, 138780, 6589640]
to_geo = Transformer.from_crs('EPSG:3011', 'EPSG:4326', always_xy=True)
to_tm = Transformer.from_crs('EPSG:3011', 'EPSG:3006', always_xy=True)
geo_corners = [to_geo.transform(e, n) for e in bbox3011[::2] for n in bbox3011[1::2]]
bbox_geo = [min(p[0] for p in geo_corners), min(p[1] for p in geo_corners),
            max(p[0] for p in geo_corners), max(p[1] for p in geo_corners)]
response = request('POST', API + '/search', json={'bbox': bbox_geo, 'limit': 500}).json()
(DEST / 'stac-search.json').write_text(json.dumps(response, ensure_ascii=False, indent=2) + '\n')
items = [item for item in response.get('features', []) if item.get('collection') == 'dtm-cog']
if not items:
    items = [item for item in response.get('features', []) if item.get('collection', '').startswith('mhm-')]
print(json.dumps({'matchingItems': [{'id': item['id'], 'collection': item['collection'],
                 'properties': item.get('properties'), 'dataAsset': item.get('assets', {}).get('data', {}).get('href')}
                for item in items]}, indent=2), flush=True)
if not items:
    raise RuntimeError('No 1 m Markhöjdmodell tile intersects the site')
if args.catalog_only:
    raise SystemExit(0)

tm_corners = [to_tm.transform(e, n) for e in bbox3011[::2] for n in bbox3011[1::2]]
clip_bounds = [math.floor(min(p[0] for p in tm_corners)) - 3, math.floor(min(p[1] for p in tm_corners)) - 3,
               math.ceil(max(p[0] for p in tm_corners)) + 3, math.ceil(max(p[1] for p in tm_corners)) + 3]
crop_paths, records = [], []
origin_documents = []
for item in items:
    asset = item.get('assets', {}).get('data') or next((v for v in item.get('assets', {}).values()
                                                     if '.tif' in v.get('href', '')), None)
    if not asset or not official(asset['href']):
        raise ValueError('Missing official GeoTIFF data asset')
    url = asset['href']
    origin_asset = item.get('assets', {}).get('metadata')
    if origin_asset:
        origin_data = request('GET', origin_asset['href']).json()
        (DEST / f"origin-{item['id']}.json").write_text(json.dumps(origin_data, ensure_ascii=False, indent=2) + '\n')
        origin_documents.append({'url': origin_asset['href'], 'data': origin_data})
    # GeoTIFFs exposed by this collection are range-readable. GDAL fetches the
    # required source blocks; the output preserves the native pixel lattice.
    auth = 'Authorization: Basic ' + base64.b64encode(f'{username}:{password}'.encode()).decode()
    with rasterio.Env(GDAL_HTTP_HEADERS=auth, GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',
                      CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif,.tiff', GDAL_HTTP_TIMEOUT='90',
                      GDAL_HTTP_MAX_RETRY='3', GDAL_HTTP_RETRY_DELAY='1'):
        with rasterio.open('/vsicurl/' + url) as src:
            if src.crs.to_epsg() not in (3006, 5845):
                raise ValueError(f'Unexpected source CRS: {src.crs}')
            window = rasterio.windows.from_bounds(*clip_bounds, transform=src.transform).round_offsets().round_lengths()
            array = src.read(1, window=window, boundless=True, masked=True)
            profile = src.profile.copy()
            profile.update(driver='GTiff', width=array.shape[1], height=array.shape[0], count=1,
                           transform=src.window_transform(window), dtype='float32', nodata=-9999,
                           compress='deflate', tiled=False)
            # Existing source tile block sizes can be incompatible with a crop.
            profile.pop('blockxsize', None); profile.pop('blockysize', None)
            crop = DEST / f"crop-{len(crop_paths)}.tif"
            with rasterio.open(crop, 'w', **profile) as dst:
                dst.write(array.filled(-9999).astype('float32'), 1)
            crop_paths.append(crop)
            records.append({'id': item['id'], 'collection': item['collection'], 'assetUrl': url,
                            'properties': item.get('properties', {}), 'sourceCrs': src.crs.to_string(),
                            'sourceResolutionM': list(src.res), 'sourceRasterSize': [src.width, src.height]})

from rasterio.merge import merge
with_handles = [rasterio.open(path) for path in crop_paths]
try:
    mosaic, transform = merge(with_handles, nodata=-9999)
    profile = with_handles[0].profile.copy()
    profile.update(transform=transform, height=mosaic.shape[1], width=mosaic.shape[2])
    output = DEST / 'dem.tif'
    with rasterio.open(output, 'w', **profile) as dst:
        dst.write(mosaic)
finally:
    for handle in with_handles:
        handle.close()
valid = np.isfinite(mosaic) & (mosaic != -9999)
if not valid.all():
    raise RuntimeError('Downloaded source crop has missing height pixels')
manifest = {'provider': 'Lantmäteriet', 'product': 'Markhöjdmodell Nedladdning 1 m', 'apiUrl': API,
            'collection': sorted({item['collection'] for item in items}), 'items': records,
            'crs': profile['crs'].to_string(), 'verticalDatum': 'RH2000', 'sourceResolutionM': 1,
            'clip': {'bounds': list(rasterio.transform.array_bounds(mosaic.shape[1], mosaic.shape[2], transform)),
                     'transform': list(transform)[:6], 'width': mosaic.shape[2], 'height': mosaic.shape[1], 'nodata': -9999},
            'retrievedAt': datetime.now(timezone.utc).isoformat(), 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
            'attribution': 'Markhöjdmodell Nedladdning, © Lantmäteriet, CC BY 4.0. Beskuret och resamplat för visning.',
            'acquisitionMethod': 'Authenticated STAC catalog, native GeoTIFF crop using HTTP byte ranges; no elevation fallback.'}
house_center = json.loads((ROOT / 'research/site/house-registration.json').read_text())['center']
parcel_ring = json.loads((ROOT / 'research/site/parcel.json').read_text())['geometry']['coordinates'][0]
acquisition_checks = [to_tm.transform(*house_center)] + [to_tm.transform(*p) for p in parcel_ring[:-1]] + tm_corners
manifest['acquisition'] = acquisition_metadata(origin_documents, transform, mosaic.shape[2], mosaic.shape[1],
                                               acquisition_checks)
(DEST / 'source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'output': str(output), 'dimensions': [mosaic.shape[2], mosaic.shape[1]],
                  'heightRangeRH2000': [float(mosaic.min()), float(mosaic.max())], 'missingPixels': int((~valid).sum())}, indent=2))
