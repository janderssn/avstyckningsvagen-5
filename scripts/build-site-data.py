#!/usr/bin/env python3
"""Build site.json from native Lantmäteriet DEM (default), without network.

Reproduce old terrain explicitly with --elevation-source municipal-contours.
DEM: numpy/rasterio/pyproj. Municipal contours: numpy/scipy.
Pixel centers and masks are respected. Any contributing nodata/outside pixel
stops the build; there is no silent fallback. Heights remain RH2000 until the
explicit estimated finished-floor datum is subtracted.
"""
import argparse
import hashlib
import json
import math
import os
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'research/site'
DEFAULT_FFL = {'lantmateriet': 20.10, 'municipal-contours': 20.55}


def read(path):
    return json.loads(Path(path).read_text())


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def file_label(path):
    try:
        return str(Path(path).resolve().relative_to(ROOT))
    except ValueError:
        return str(Path(path).resolve())


def registration_grid(registration, parcel_source):
    origin = np.asarray(registration['center'], dtype=float)
    axes = np.asarray([registration['localXUnitEN'], registration['localZUnitEN']], dtype=float)
    if origin.shape != (2,) or axes.shape != (2, 2) or not np.isfinite(origin).all() or not np.isfinite(axes).all() or not np.allclose(axes @ axes.T, np.eye(2), atol=1e-7):
        raise ValueError('House registration requires finite orthonormal EN axes')
    ring = np.asarray(parcel_source['geometry']['coordinates'][0], dtype=float)
    if np.linalg.norm(ring[0] - ring[-1]) < 1e-6:
        ring = ring[:-1]
    parcel = (ring - origin) @ axes.T
    minimum, maximum = np.floor(parcel.min(axis=0) - 16), np.ceil(parcel.max(axis=0) + 16)
    xx, zz = np.meshgrid(np.arange(minimum[0], maximum[0] + 1), np.arange(minimum[1], maximum[1] + 1))
    return origin, axes, parcel, minimum, maximum, xx, zz


def sample_dem(dem_path, east, north, input_crs):
    """Bilinear physical pixel-center heights, with strict contributing masks.

    Horizontal CRS transformation only, always E/N order. A compound raster CRS
    such as EPSG:5845 is reduced to its horizontal CRS for coordinate conversion;
    its RH2000 elevation values are not geoid-transformed.
    """
    import rasterio
    from pyproj import CRS, Transformer
    east, north = np.broadcast_arrays(np.asarray(east, float), np.asarray(north, float))
    if not np.isfinite(east).all() or not np.isfinite(north).all():
        raise ValueError('DEM coordinates must be finite')
    with rasterio.open(dem_path) as dataset:
        if dataset.crs is None or dataset.count != 1:
            raise ValueError('DEM requires a CRS and one elevation band')
        if dataset.width * dataset.height > 25_000_000:
            raise ValueError('Provide a clipped DEM of at most 25 million pixels')
        unit = (dataset.units[0] or 'm').lower()
        if unit not in ('m', 'metre', 'metres', 'meter', 'meters'):
            raise ValueError(f'DEM band unit is not metres: {unit}')
        horizontal = CRS.from_user_input(dataset.crs).to_2d()
        transform = Transformer.from_crs(CRS.from_user_input(input_crs).to_2d(), horizontal, always_xy=True, allow_ballpark=False)
        xs, ys = transform.transform(east, north, errcheck=True)
        col, row = (~dataset.transform) * (xs, ys)
        col, row = np.asarray(col) - 0.5, np.asarray(row) - 0.5
        # Suppress <10 nm projection noise around exact pixel centers.
        col = np.where(np.abs(col - np.rint(col)) < 1e-8, np.rint(col), col)
        row = np.where(np.abs(row - np.rint(row)) < 1e-8, np.rint(row), row)
        if not np.isfinite(col).all() or not np.isfinite(row).all():
            raise ValueError('Nonfinite transformed pixels')
        c0, r0 = np.floor(col).astype(np.int64), np.floor(row).astype(np.int64)
        tx, ty = col - c0, row - r0
        band = dataset.read(1, masked=True).astype(np.float64)
        scale, offset = float(dataset.scales[0]), float(dataset.offsets[0])
        if not np.isfinite([scale, offset]).all() or scale <= 0:
            raise ValueError('Invalid DEM scale/offset')
        values = np.asarray(band.data) * scale + offset
        valid = ~np.ma.getmaskarray(band) & np.isfinite(values)
        result, outside, nodata = np.zeros(east.shape), np.zeros(east.shape, bool), np.zeros(east.shape, bool)
        for dc, dr, weight in [(0, 0, (1-tx)*(1-ty)), (1, 0, tx*(1-ty)), (0, 1, (1-tx)*ty), (1, 1, tx*ty)]:
            cc, rr = c0 + dc, r0 + dr
            active = weight > 0
            inside = (cc >= 0) & (cc < dataset.width) & (rr >= 0) & (rr < dataset.height)
            sc, sr = np.clip(cc, 0, dataset.width-1), np.clip(rr, 0, dataset.height-1)
            outside |= active & ~inside
            nodata |= active & inside & ~valid[sr, sc]
            result += np.where(active & inside & valid[sr, sc], values[sr, sc] * weight, 0)
        if outside.any() or nodata.any():
            raise ValueError(f'DEM lacks full grid support: {int(outside.sum())} samples outside pixel-center coverage; '
                             f'{int(nodata.sum())} samples touch contributing nodata/nonfinite pixels. No values filled.')
        if not np.isfinite(result).all():
            raise ValueError('Nonfinite DEM interpolation')
        details = {'crs': dataset.crs.to_string(), 'horizontalCrs': horizontal.to_string(),
                   'width': dataset.width, 'height': dataset.height, 'transform': list(dataset.transform)[:6],
                   'pixelSizeM': list(dataset.res), 'nodata': float(dataset.nodata) if dataset.nodata is not None and math.isfinite(dataset.nodata) else None,
                   'scale': scale, 'offset': offset, 'unit': unit, 'sampleCount': int(result.size),
                   'outsideRasterSamples': 0, 'nodataSamples': 0,
                   'sampling': 'Bilinear sampling of native raster pixel centers, always_xy horizontal CRS transformation; no nodata filling or extrapolation',
                   'horizontalTransform': transform.description}
    return result, details


def municipal_terrain(evidence, origin, axes, xx, zz):
    """Archived contour algorithm preserved, including its explicit hull fallback."""
    from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
    samples = []
    for contour in evidence['contours']:
        height, points = float(contour['elevation']), np.array(contour['coordinates'])
        for a, b in zip(points[:-1], points[1:]):
            for t in np.linspace(0, 1, max(1, math.ceil(np.linalg.norm(b-a))), endpoint=False):
                samples.append([*(a+t*(b-a)), height])
        samples.append([*points[-1], height])
    samples.extend([p['E'], p['N'], p['elevation']] for p in evidence['spotHeights'])
    samples = np.array(samples)
    if len(samples) < 3 or not np.isfinite(samples).all():
        raise ValueError('Invalid municipal observations')
    unique = {}
    for east, north, height in samples:
        unique.setdefault((round(east, 5), round(north, 5)), []).append(height)
    points, heights = np.array(list(unique)), np.array([np.mean(v) for v in unique.values()])
    local_points = (points-origin) @ axes.T
    terrain = LinearNDInterpolator(local_points, heights)(xx, zz)
    outside = ~np.isfinite(terrain)
    terrain[outside] = NearestNDInterpolator(local_points, heights)(xx[outside], zz[outside])
    return terrain, {'heightSourceContourCount': len(evidence['contours']), 'heightSourceSpotCount': len(evidence['spotHeights']),
                     'samplesAfterDensification': len(points), 'outsideSourceHullCells': int(outside.sum())}


def build_data(elevation_source, dem_path, manifest_path, ground_floor_height=None, earthworks_path=SOURCE/'earthworks.json'):
    registration, parcel_source = read(SOURCE/'house-registration.json'), read(SOURCE/'parcel.json')
    origin, axes, parcel, minimum, maximum, xx, zz = registration_grid(registration, parcel_source)
    registration_crs = registration['crs']
    ffl = DEFAULT_FFL[elevation_source] if ground_floor_height is None else ground_floor_height
    if not math.isfinite(ffl):
        raise ValueError('Finished-floor datum must be finite')
    source_files = [SOURCE/'parcel.json', SOURCE/'house-registration.json']
    sources = [
        {'title': 'Järfällakartan · fastighetsgräns och byggnadsläge', 'url': 'https://jarfallakartan.jarfalla.se/spatialmap',
         'status': 'Kommunens kartdata', 'detail': 'VIKSJÖ 2:573, cirka 578 m². Husets läge och nordriktning från kommunens takkant.'},
        {'title': 'Baskarta · tomt och höjdkurvor', 'url': '/sources/site-baskarta.png', 'image': '/sources/site-baskarta.png',
         'status': 'Kommunens kartdata', 'detail': 'Kommunens publika baskarta används för tomt- och byggnadsregistrering.'}]
    datum = {'groundFloorHeightRH2000': ffl, 'groundFloorHeightStatus': 'estimated', 'heightOverride': ground_floor_height is not None}
    if elevation_source == 'lantmateriet':
        if not Path(dem_path).is_file() or not Path(manifest_path).is_file():
            raise ValueError('Lantmäteriet dem.tif and source.json required; existing output remains unchanged. Use --elevation-source municipal-contours explicitly for old terrain.')
        manifest = read(manifest_path)
        if str(manifest.get('verticalDatum', '')).replace(' ', '').upper() != 'RH2000':
            raise ValueError('Source manifest must explicitly establish RH2000')
        if manifest.get('provider') != 'Lantmäteriet' or not manifest.get('product'):
            raise ValueError('Source manifest must identify Lantmäteriet and product')
        if manifest.get('sha256') != sha256(dem_path):
            raise ValueError('DEM checksum differs from source.json')
        east, northing = origin[0]+xx*axes[0,0]+zz*axes[1,0], origin[1]+xx*axes[0,1]+zz*axes[1,1]
        terrain, raster_info = sample_dem(dem_path, east, northing, registration_crs)
        from pyproj import CRS
        if not manifest.get('crs') or CRS.from_user_input(manifest['crs']) != CRS.from_user_input(raster_info['crs']):
            raise ValueError('DEM CRS differs from source manifest')
        declared_resolution = np.asarray(manifest.get('sourceResolutionM'), dtype=float)
        if declared_resolution.size not in (1, 2) or not np.isfinite(declared_resolution).all() or not (declared_resolution > 0).all() or not np.allclose(raster_info['pixelSizeM'], declared_resolution, rtol=0, atol=1e-6):
            raise ValueError('DEM pixel size differs from sourceResolutionM in source manifest')
        source_files += [Path(dem_path), Path(manifest_path)]
        checks = []
        for label, x, z in [('garage', 2.7, 5.6), ('front', 0, 5.6), ('garden', 0, -5.6), ('entrance', -4.3, 0)]:
            en = origin + x*axes[0] + z*axes[1]
            value, _ = sample_dem(dem_path, en[0], en[1], registration_crs)
            checks.append({'label': label, 'localXZ': [x,z], 'sourceHeightRH2000': float(value), 'modelHeight': float(value)-ffl})
        datum['registrationTiePoint'] = {**checks[0], 'groundFloorAboveGarageM': 2.45,
            'method': 'Explicit FFL override; driveway point reported for comparison, not a surveyed floor elevation' if ground_floor_height is not None else 'Estimated FFL from DEM driveway sample plus archival 2.45 m floor separation, rounded to centimetres; not a surveyed floor elevation'}
        meta = {'heightSource': 'lantmateriet-dem', 'elevationProvider': manifest['provider'], 'elevationProduct': manifest['product'],
                'elevationSourceResolutionM': manifest.get('sourceResolutionM'), 'elevationVerticalDatum': manifest['verticalDatum'],
                'elevationAcquisition': manifest.get('acquisition'), 'elevationRetrievedAt': manifest.get('retrievedAt'),
                'elevationAttribution': manifest.get('attribution'), 'elevationLicense': manifest.get('license'),
                'elevationCollection': manifest.get('collection'), 'elevationItemIds': [item['id'] for item in manifest.get('items', [])],
                'dem': raster_info, 'heightMethod': raster_info['sampling'], 'heightChecks': checks}
        date = (manifest.get('acquisition') or {}).get('date', 'ej angivet')
        status = 'Tomt · Lantmäteriets markhöjdmodell'
        note = f'578 m² · Lantmäteriets 1 m markhöjdmodell, mätt {date}. Husets höjdpassning är uppskattad.'
        height_note = 'Markhöjder från Lantmäteriets GeoTIFF samplas bilinjärt till modellens roterade 1 m rutnät. Källrastrets upplösning är inte dess mätnoggrannhet. Mätåret kan vara äldre än kommunens höjdkurvor.'
        sources.insert(0, {'title': manifest['product'], 'url': 'https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/markhojdmodell-nedladdning/',
            'status': 'Lantmäteriets höjdraster', 'detail': f"{manifest.get('attribution', 'Lantmäteriet').rstrip('.')}. Mätt {date}. RH2000; bilinjär omsampling från {raster_info['pixelSizeM'][0]:g} m raster."})
        if manifest.get('licenseUrl'):
            sources.insert(1, {'title': f"Licens · {manifest.get('license', 'Lantmäteriets data')}", 'url': manifest['licenseUrl'],
                'status': 'Licens och erkännande', 'detail': manifest.get('attribution', '© Lantmäteriet')})
    else:
        evidence = read(SOURCE/'elevation-evidence.json')
        terrain, meta = municipal_terrain(evidence, origin, axes, xx, zz)
        meta.update({'heightSource': 'municipal-contours', 'heightMethod': 'Linear TIN interpolation between municipal contours and spot heights, sampled at 1 m; nearest outside convex hull.'})
        source_files.append(SOURCE/'elevation-evidence.json')
        status = 'Tomt · kommunens karta'
        note = '578 m² · kommunens tomtgräns. Terräng interpolerad från höjdkurvor; husets höjdläge uppskattat.'
        height_note = 'Arkiverad konturmetod: interpolerade höjdkurvor och markpunkter med 1 m visningsrutnät; detta är inte ett höjdraster från Lantmäteriet.'
    if not np.isfinite(terrain).all():
        raise ValueError('Nonfinite terrain; output not written')
    earthworks = read(earthworks_path) if earthworks_path is not None else None
    if earthworks is not None:
        if earthworks.get('status') != 'photo-interpreted' or not earthworks.get('surfacePatches'):
            raise ValueError('Earthworks must identify photo-interpreted surface patches')
        source_files.append(Path(earthworks_path))
        sources.append({'title': 'Garageinfart och stödmurar · gatubild 2022',
            'url': '/sources/google-streetview-2022-number5-position2.png',
            'image': '/sources/google-streetview-2022-number5-position2.png',
            'status': 'Fototolkad markanpassning',
            'detail': 'Oktober 2022, © Google. Hårdgjord urgrävning, vänster planteringsmur och höger stödmur med vita brädor. Mått och lutningar är uppskattade; den bortre muränden skyms av växtlighet.'})
        note += ' Infart och stödmurar är anpassade efter foton.'
    north = axes @ np.array([0, 1])
    return {'parcel': np.round(parcel, 6).tolist(),
        **({'earthworks': earthworks} if earthworks is not None else {}),
        'footprint': [[-4.075,-5.325], [4.075,-5.325], [4.075,5.325], [-4.075,5.325]],
        'heightGrid': {'x0': int(minimum[0]), 'z0': int(minimum[1]), 'dx': 1, 'dz': 1, 'cols': xx.shape[1], 'rows': xx.shape[0],
                       'heights': np.round(terrain-ffl, 4).flatten().tolist()},
        'contextBounds': {'min': minimum.tolist(), 'max': maximum.tolist()},
        'terrainResolution': 0.9, 'gridSpacing': 2.5, 'contourResolution': 1, 'contourInterval': 1, 'contourOffset': -ffl,
        'metadata': {'title': 'Avstyckningsvägen 5 · VIKSJÖ 2:573', 'sourceStatus': status, 'note': note, 'sources': sources,
            'assumptions': ['Tomtgränsen följer kommunens kartgeometri och är inte en gränsbestämning på plats.', height_note,
                f'Bottenplanets höjd är uppskattad till {ffl:.2f}'.replace('.', ',')+' m RH2000. Passning mot infartsmark och arkivets våningsskillnad är inte en inmätt golvhöjd.',
                'Husets läge och nordriktning har passats mot kommunens takkant; arkivets väggmått behålls.'] +
                (['Garageinfartens urgrävning, beläggning och stödmurar är lokala fototolkningar ovanpå höjdmodellen. Källrastret är oförändrat. Planform, murhöjder och lutningar är uppskattade, inte inmätta.'] if earthworks is not None else []),
            'northDirection': north.tolist(), 'northRotation': math.atan2(north[0], -north[1]),
            'georeferencing': {'crs': registration_crs, 'verticalDatum': 'RH2000', 'originEN': origin.tolist(),
                              'localXUnitEN': axes[0].tolist(), 'localZUnitEN': axes[1].tolist(), **datum},
            'heightRangeRH2000': [float(terrain.min()), float(terrain.max())],
            'sourceFilesSha256': {file_label(path): sha256(path) for path in source_files}, **meta}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--elevation-source', choices=list(DEFAULT_FFL), default='lantmateriet')
    parser.add_argument('--dem', type=Path, default=SOURCE/'lantmateriet/dem.tif')
    parser.add_argument('--dem-source', type=Path, default=SOURCE/'lantmateriet/source.json')
    parser.add_argument('--ground-floor-height', type=float, help='Explicit estimated FFL override in RH2000 metres')
    parser.add_argument('--earthworks', type=Path, default=SOURCE/'earthworks.json', help='Photo-interpreted local excavation and retaining-wall controls')
    parser.add_argument('--without-earthworks', action='store_true', help='Reproduce unmodified raster terrain without photo-interpreted earthworks')
    parser.add_argument('--output', type=Path, default=ROOT/'public/data/site.json')
    args = parser.parse_args()
    try:
        data = build_data(args.elevation_source, args.dem, args.dem_source, args.ground_floor_height,
                          None if args.without_earthworks else args.earthworks)
        serialized = json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n'
    except (OSError, ValueError, KeyError, ImportError) as error:
        parser.exit(2, str(error)+'\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', dir=args.output.parent, delete=False, suffix='.tmp') as stream:
        temporary = Path(stream.name)
        stream.write(serialized)
    os.replace(temporary, args.output)
    print(json.dumps({'output': str(args.output), 'heightSource': data['metadata']['heightSource'],
        'grid': [data['heightGrid']['cols'], data['heightGrid']['rows']], 'heightRangeRH2000': data['metadata']['heightRangeRH2000'],
        'groundFloorHeightRH2000': data['metadata']['georeferencing']['groundFloorHeightRH2000'],
        'heightChecks': data['metadata'].get('heightChecks')}, indent=2))


if __name__ == '__main__':
    main()
