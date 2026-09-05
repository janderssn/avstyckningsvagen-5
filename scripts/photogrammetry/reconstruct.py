#!/usr/bin/env python3
"""Audited CPU COLMAP SfM. Never synthesize missing surfaces or report metric certainty."""
import argparse
import hashlib
import json
import math
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def dhash(image):
    gray = np.asarray(image.convert("L").resize((17, 16)), dtype=np.int16)
    return gray[:, 1:] > gray[:, :-1]


def audit(manifest_path):
    manifest_path = Path(manifest_path).resolve()
    manifest = json.loads(manifest_path.read_text())
    records, warnings, errors, accepted, signatures = [], [], [], [], []
    positions, panoramas, hashes = set(), set(), set()
    for entry in manifest["images"]:
        file = (manifest_path.parent / entry["file"]).resolve()
        record = {"file": str(file), "accepted": False, "reasons": []}
        reasons = record["reasons"]
        try:
            with Image.open(file) as original:
                picture = ImageOps.exif_transpose(original).convert("RGB")
                record["size"] = list(picture.size)
                digest = hashlib.sha256(file.read_bytes()).hexdigest()
                record["sha256"] = digest
                signature = dhash(picture)
                if min(picture.size) < 480:
                    reasons.append("Image shorter side below 480 px")
                if digest in hashes:
                    reasons.append("Exact duplicate image")
                for previous_name, previous_signature in signatures:
                    distance = int(np.count_nonzero(signature != previous_signature))
                    if distance <= 5:
                        reasons.append(f"Near duplicate of {previous_name}: dHash distance {distance}/256")
                source = entry.get("source_type")
                if source not in ("original_photo", "streetview_perspective"):
                    reasons.append("source_type must be original_photo or streetview_perspective; drawings and equirectangular panoramas are not perspective photos")
                position = entry.get("camera_position_id")
                panorama = entry.get("panorama_id")
                if not position:
                    reasons.append("Missing camera_position_id; distinct physical camera positions must be documented")
                elif position in positions:
                    reasons.append("Same camera position as another image; no independent baseline")
                if source == "streetview_perspective":
                    if not panorama:
                        reasons.append("Missing Street View panorama_id; camera baseline cannot be verified")
                    elif panorama in panoramas:
                        reasons.append("Same Street View panorama as another image; panning/zooming adds no baseline")
                    if not entry.get("exclude_rectangles"):
                        reasons.append("Street View screenshot requires exclude_rectangles for UI overlays")
                    warnings.append(f"{file.name}: stitched Street View imagery and moving foliage can introduce non-pinhole artifacts; experimental facade reference only")
                if not reasons:
                    accepted.append({**entry, "resolved_file": str(file)})
                    positions.add(position)
                    if panorama:
                        panoramas.add(panorama)
                    hashes.add(digest)
                    signatures.append((file.name, signature))
                    record["accepted"] = True
        except (OSError, ValueError) as exc:
            reasons.append(str(exc))
        records.append(record)
    if len(accepted) < 3:
        errors.append(f"Need at least 3 accepted distinct camera positions for this SfM run; found {len(accepted)}")
    warnings.append("Three positions only permit an experiment; they do not establish complete building coverage or architectural accuracy")
    report = {
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": manifest.get("dataset"),
        "coverage_declared": manifest.get("coverage", "Not documented"),
        "status": "input_rejected" if errors else "ready_for_sfm_attempt",
        "image_count": len(records), "accepted_count": len(accepted),
        "distinct_documented_positions": len(positions),
        "images": records, "errors": errors, "warnings": warnings,
        "reconstruction_completed": False, "architectural_accuracy_verified": False,
        "triangulated_points": 0,
        "limitations": ["Metadata assertions and duplicate checks do not prove true baseline; estimated poses and triangulation must be checked", "Interior and occluded surfaces cannot be recovered without photographs", "8.15 m is an archive plan dimension, not a current measured control distance"],
    }
    return report, accepted


def prepare_images(entries, output):
    image_dir, mask_dir = output / "images", output / "masks"
    image_dir.mkdir()
    mask_dir.mkdir()
    prepared = []
    for index, entry in enumerate(entries):
        original = Path(entry["resolved_file"])
        name = f"{index:04d}_{original.stem}.png"
        with Image.open(original) as source:
            image = ImageOps.exif_transpose(source).convert("RGB")
            # PNG preserves pixels and gives predictable orientation. Originals stay untouched.
            image.save(image_dir / name, exif=image.getexif())
        polygons = entry.get("include_polygons", [])
        mask = Image.new("L", image.size, 0 if polygons else 255)
        draw = ImageDraw.Draw(mask)
        for polygon in polygons:
            if len(polygon) < 3 or any(len(point) != 2 or not (0 <= point[0] <= image.width and 0 <= point[1] <= image.height) for point in polygon):
                raise ValueError(f"Invalid include polygon for {original.name}")
            draw.polygon([tuple(point) for point in polygon], fill=255)
        for polygon in entry.get("exclude_polygons", []):
            if len(polygon) < 3 or any(len(point) != 2 or not (0 <= point[0] <= image.width and 0 <= point[1] <= image.height) for point in polygon):
                raise ValueError(f"Invalid exclude polygon for {original.name}")
            draw.polygon([tuple(point) for point in polygon], fill=0)
        for rect in entry.get("exclude_rectangles", []):
            if len(rect) != 4 or not (0 <= rect[0] < rect[2] <= image.width and 0 <= rect[1] < rect[3] <= image.height):
                raise ValueError(f"Invalid mask rectangle for {original.name}: {rect}")
            draw.rectangle(rect, fill=0)
        # COLMAP mask convention is original-name.ext.png.
        mask.save(mask_dir / (name + ".png"))
        prepared.append({**entry, "prepared_name": name, "width": image.width, "height": image.height})
    write_json(output / "prepared-input.json", prepared)
    return image_dir, mask_dir, prepared


def extract_and_match(pycolmap, prepared, image_dir, mask_dir, database, threads, matching_ratio=0.8):
    extraction = pycolmap.FeatureExtractionOptions()
    extraction.num_threads = threads
    extraction.max_image_size = 2400
    extraction.use_gpu = False
    for entry in prepared:
        reader = pycolmap.ImageReaderOptions()
        reader.mask_path = str(mask_dir)
        model = "PINHOLE" if entry["source_type"] == "streetview_perspective" else "SIMPLE_RADIAL"
        if entry.get("camera_params"):
            reader.camera_params = ",".join(str(p) for p in entry["camera_params"])
        pycolmap.extract_features(str(database), str(image_dir),
            image_names=[entry["prepared_name"]], camera_mode=pycolmap.CameraMode.PER_IMAGE,
            camera_model=model, reader_options=reader, extraction_options=extraction,
            device=pycolmap.Device.cpu)
    matching = pycolmap.FeatureMatchingOptions()
    matching.num_threads = threads
    matching.use_gpu = False
    matching.sift.max_ratio = matching_ratio
    pycolmap.match_exhaustive(str(database), matching_options=matching, device=pycolmap.Device.cpu)


def database_report(database):
    with sqlite3.connect(database) as db:
        images = {row[0]: row[1] for row in db.execute("SELECT image_id, name FROM images")}
        features = [{"image": images[image_id], "features": rows} for image_id, rows in db.execute("SELECT image_id, rows FROM keypoints")]
        pairs = []
        for pair_id, rows, config in db.execute("SELECT pair_id, rows, config FROM two_view_geometries"):
            second = pair_id % 2147483647
            first = (pair_id - second) // 2147483647
            pairs.append({"images": [images[first], images[second]], "verified_matches": rows, "geometry_config": config})
    return {"features": features, "verified_pairs": pairs}


def align(pycolmap, reconstruction, alignment_path):
    controls = json.loads(Path(alignment_path).read_text())
    src = np.array([point["sfm_xyz"] for point in controls["control_points"]], dtype=float)
    dst = np.array([point["model_xyz_m"] for point in controls["control_points"]], dtype=float)
    if src.shape != dst.shape or src.ndim != 2 or src.shape[1] != 3 or len(src) < 3:
        raise ValueError("Alignment needs at least 3 corresponding xyz control points")
    if not np.isfinite(src).all() or not np.isfinite(dst).all():
        raise ValueError("Control coordinates must be finite")
    if np.linalg.matrix_rank(src - src.mean(0)) < 2 or np.linalg.matrix_rank(dst - dst.mean(0)) < 2:
        raise ValueError("Control points must not be collinear")
    transform = pycolmap.estimate_sim3d(src, dst)
    if transform is None or not math.isfinite(transform.scale) or transform.scale <= 0:
        raise ValueError("Could not solve positive metric similarity transform")
    residuals = np.linalg.norm((transform.scale * (transform.rotation.matrix() @ src.T).T + transform.translation) - dst, axis=1)
    reconstruction.transform(transform)
    return {"unit": "metres", "up_axis": "Y (must be established by supplied controls)",
        "scale": transform.scale, "matrix_3x4": transform.matrix().tolist(),
        "control_residuals_m": residuals.tolist(), "rms_control_residual_m": float(np.sqrt(np.mean(residuals ** 2))),
        "control_source": controls.get("source", "Not documented"),
        "caution": "Fitted-control residual is not independent accuracy validation; check independent measured distances"}


def export_points(reconstruction, output):
    import trimesh
    reconstruction.export_PLY(str(output / "sparse.ply"))
    points = sorted(reconstruction.points3D.items())
    xyz = np.array([point.xyz for _, point in points])
    rgb = np.array([point.color for _, point in points], dtype=np.uint8)
    trimesh.Scene(trimesh.points.PointCloud(xyz, colors=rgb)).export(output / "sparse.glb")
    write_json(output / "point-identities.json", [{"id": point_id, "xyz": point.xyz.tolist(), "track_length": point.track.length(), "reprojection_error_px": point.error} for point_id, point in points])
    cameras = [{"image": image.name, "center": image.projection_center().tolist()} for image in reconstruction.images.values() if image.has_pose]
    write_json(output / "camera-centers.json", cameras)
    distances = [float(np.linalg.norm(np.array(a["center"]) - np.array(b["center"]))) for i, a in enumerate(cameras) for b in cameras[i + 1:]]
    return {"minimum_camera_baseline": min(distances) if distances else None,
        "maximum_camera_baseline": max(distances) if distances else None}


def run(args):
    if args.command == "align":
        import pycolmap
        output = Path(args.output).resolve()
        if output.exists() and any(output.iterdir()):
            raise ValueError("Output must be new or empty")
        reconstruction = pycolmap.Reconstruction(args.model)
        report = align(pycolmap, reconstruction, args.alignment)
        output.mkdir(parents=True, exist_ok=True)
        reconstruction.write(str(output))
        reconstruction.write_text(str(output))
        report["camera_baselines"] = export_points(reconstruction, output)
        report["architectural_accuracy_verified"] = False
        write_json(output / "alignment-report.json", report)
        print("Aligned point exports: " + str(output))
        return 0
    report, entries = audit(args.manifest)
    if args.command == "audit":
        write_json(args.report, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 2 if report["errors"] else 0
    output = Path(args.output).resolve()
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output must be new or empty; use a new output path to preserve prior evidence")
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / "quality-report.json"
    write_json(report_path, report)
    if report["errors"]:
        print("Input rejected; see " + str(report_path))
        return 2
    import pycolmap
    report["engine"] = {"pycolmap": pycolmap.__version__, "device": "cpu", "cuda_available": pycolmap.has_cuda}
    try:
        image_dir, mask_dir, prepared = prepare_images(entries, output)
        database = output / "database.db"
        report["parameters"] = {"sift_matching_ratio": args.matching_ratio, "min_geometric_inliers": 15,
            "min_initial_pair_inliers": 100, "initial_min_triangulation_angle_deg": 16,
            "point_min_triangulation_angle_deg": 1.5, "max_reprojection_error_px": 4,
            "ignore_two_view_tracks": True, "note": "COLMAP geometric defaults retained; only descriptor ratio is configurable"}
        extract_and_match(pycolmap, prepared, image_dir, mask_dir, database, args.threads, args.matching_ratio)
        report["matching"] = database_report(database)
        sparse = output / "sparse"
        sparse.mkdir()
        options = pycolmap.IncrementalPipelineOptions()
        options.num_threads = args.threads
        options.random_seed = 0
        options.mapper.random_seed = 0
        options.min_model_size = 3
        options.max_runtime_seconds = args.max_seconds
        maps = pycolmap.incremental_mapping(str(database), str(image_dir), str(sparse), options=options)
        report["components"] = [{"id": idx, "registered_images": rec.num_reg_images(), "points": rec.num_points3D()} for idx, rec in maps.items()]
        if not maps:
            report["status"] = "sfm_failed_no_reconstruction"
            report["errors"].append("COLMAP could not initialize a valid sparse model; do not infer 3D shape from matches alone")
            return 3
        index, reconstruction = max(maps.items(), key=lambda item: (item[1].num_reg_images(), item[1].num_points3D()))
        if reconstruction.num_reg_images() < 3 or reconstruction.num_points3D() == 0:
            report["status"] = "sfm_insufficient_registration"
            report["errors"].append("Best component has fewer than 3 registered views or no points")
            return 3
        report["alignment"] = {"unit": "arbitrary SfM units", "up_axis": "unoriented", "metric": False}
        if args.alignment:
            report["alignment"] = {**align(pycolmap, reconstruction, args.alignment), "metric": True}
        export_dir = output / "export"
        export_dir.mkdir()
        reconstruction.write(str(export_dir))
        reconstruction.write_text(str(export_dir))
        report["camera_baselines"] = export_points(reconstruction, export_dir)
        report.update({"status": "sparse_reconstruction_only", "reconstruction_completed": True,
            "selected_component": index, "registered_images": reconstruction.num_reg_images(),
            "registration_fraction": reconstruction.num_reg_images() / len(entries),
            "triangulated_points": reconstruction.num_points3D(),
            "mean_track_length": reconstruction.compute_mean_track_length(),
            "mean_reprojection_error_px": reconstruction.compute_mean_reprojection_error()})
        report["dense"] = {"status": "not_requested", "mesh_generated": False}
        if args.dense:
            if not pycolmap.has_cuda:
                report["dense"]["status"] = "unavailable_no_cuda"
                report["warnings"].append("This pycolmap wheel has no CUDA; sparse export remains valid, dense stereo was not run")
            else:
                dense = output / "dense"
                pycolmap.undistort_images(str(dense), str(export_dir), str(image_dir))
                pycolmap.patch_match_stereo(str(dense))
                pycolmap.stereo_fusion(str(dense / "dense.ply"), str(dense))
                report["dense"]["status"] = "dense_points_only"
        return 0
    except Exception as exc:
        report["status"] = "pipeline_error"
        report["errors"].append(f"{type(exc).__name__}: {exc}")
        raise
    finally:
        write_json(report_path, report)
        print("Quality report: " + str(report_path))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    check = commands.add_parser("audit", help="Validate images, camera positions, provenance and duplicates")
    check.add_argument("manifest")
    check.add_argument("--report", required=True)
    sfm = commands.add_parser("run", help="Audit then execute CPU SIFT, matching, sparse SfM and point exports")
    sfm.add_argument("manifest")
    sfm.add_argument("--output", required=True)
    sfm.add_argument("--threads", type=int, default=4)
    sfm.add_argument("--max-seconds", type=int, default=600)
    sfm.add_argument("--matching-ratio", type=float, default=0.8, choices=[0.7, 0.75, 0.8, 0.85, 0.9], help="Descriptor ambiguity threshold; geometric quality gates stay unchanged")
    sfm.add_argument("--alignment", help="JSON with 3+ noncollinear SfM/model metre control point pairs")
    sfm.add_argument("--dense", action="store_true", help="Run CUDA dense stereo only if available; no fabricated CPU fallback")
    metric = commands.add_parser("align", help="Align an inspected COLMAP model to 3+ measured control points and re-export")
    metric.add_argument("model", help="COLMAP model directory containing cameras/images/points3D files")
    metric.add_argument("--alignment", required=True)
    metric.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        return run(args)
    except (OSError, ValueError, KeyError, ImportError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
