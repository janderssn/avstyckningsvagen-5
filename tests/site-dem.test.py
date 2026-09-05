"""Synthetic pixel/CRS fixtures only; no synthetic height is published as house data."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import numpy as np
import rasterio
from affine import Affine
from pyproj import Transformer

script = Path(__file__).resolve().parents[1] / 'scripts/build-site-data.py'
spec = importlib.util.spec_from_file_location('site_builder', script)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class RasterSamplingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='site-dem-test-')
        self.path = Path(self.temp.name) / 'fixture.tif'
        self.affine = Affine(1, 0, 658900, 0, -1, 6590300)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, values, transform=None, crs='EPSG:3006', mask=None):
        with rasterio.open(self.path, 'w', driver='GTiff', width=values.shape[1], height=values.shape[0],
                           count=1, dtype='float64', crs=crs, transform=transform or self.affine, nodata=-9999) as dataset:
            dataset.write(values, 1)
            if mask is not None:
                dataset.write_mask(mask)

    def sample(self, col, row, crs='EPSG:3006', transform=None):
        x, y = (transform or self.affine) * (np.asarray(col)+0.5, np.asarray(row)+0.5)
        return builder.sample_dem(self.path, x, y, crs)[0]

    def test_pixel_centers_north_up_and_bilinear_plane(self):
        values = np.fromfunction(lambda row, col: 20+col*2+row*3, (5, 6))
        self.write(values)
        np.testing.assert_allclose(self.sample([0, 1.25, 5], [0, 2.5, 4]), [20, 30, 42], atol=1e-9)

    def test_rotated_raster_affine_has_no_half_pixel_shift(self):
        transform = Affine(1.7, 0.35, 658900, 0.2, -1.3, 6590300)
        values = np.fromfunction(lambda row, col: 10+col*2+row*3, (6, 7))
        self.write(values, transform)
        np.testing.assert_allclose(self.sample([0, 2.2, 6], [0, 3.4, 5], transform=transform), [10, 24.6, 37], atol=1e-7)

    def test_compound_5845_and_3011_use_en_axis_order(self):
        values = np.fromfunction(lambda row, col: 20+col*2+row*3, (5, 6))
        self.write(values, crs='EPSG:5845')
        x, y = self.affine * (np.array([1.75, 3.5]), np.array([2.25, 1.5]))
        east, north = Transformer.from_crs('EPSG:3006', 'EPSG:3011', always_xy=True).transform(x, y)
        actual, metadata = builder.sample_dem(self.path, east, north, 'EPSG:3011')
        np.testing.assert_allclose(actual, [27.75, 29], atol=1e-7)
        self.assertEqual(metadata['horizontalCrs'], 'EPSG:3006')

    def test_nodata_and_dataset_masks_are_not_filled(self):
        values = np.full((5, 6), 20.0)
        values[2, 2] = -9999
        self.write(values)
        with self.assertRaisesRegex(ValueError, 'nodata'):
            self.sample(1.5, 1.5)
        # A masked neighbor of zero weight must not invalidate an exact center.
        self.assertEqual(float(self.sample(1, 1)), 20)
        mask = np.full((5, 6), 255, dtype=np.uint8)
        mask[1, 1] = 0
        self.write(np.full((5, 6), 20.0), mask=mask)
        with self.assertRaisesRegex(ValueError, 'nodata'):
            self.sample(1, 1)

    def test_outside_support_is_not_clamped_or_extrapolated(self):
        self.write(np.full((5, 6), 20.0))
        for col, row in [(-0.1, 1), (5.1, 1), (1, -0.1), (1, 4.1)]:
            with self.assertRaisesRegex(ValueError, 'outside'):
                self.sample(col, row)

    def test_nonfinite_values_and_scale_offset(self):
        values = np.full((5, 6), 100.0)
        self.write(values)
        with rasterio.open(self.path, 'r+') as dataset:
            dataset.scales = (0.1,)
            dataset.offsets = (2.0,)
        self.assertAlmostEqual(float(self.sample(2, 2)), 12)
        values[2, 2] = np.nan
        self.write(values)
        with self.assertRaisesRegex(ValueError, 'nonfinite'):
            self.sample(2, 2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
