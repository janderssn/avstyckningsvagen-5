#!/usr/bin/env python3
"""Independent image-matching diagnostics; never exports a recovered house."""
import argparse
import itertools
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


def read_colmap(database):
    result = []
    with sqlite3.connect(database) as db:
        for image_id, name in db.execute("SELECT image_id,name FROM images ORDER BY image_id"):
            rows, cols, data = db.execute("SELECT rows,cols,data FROM descriptors WHERE image_id=?", (image_id,)).fetchone()
            descriptors = np.frombuffer(data, np.uint8).reshape(rows, cols).astype(np.float32)
            rows, cols, data = db.execute("SELECT rows,cols,data FROM keypoints WHERE image_id=?", (image_id,)).fetchone()
            keypoints = np.frombuffer(data, np.float32).reshape(rows, cols)[:, :2]
            result.append((name, keypoints, descriptors))
    return result


def features_opencv(image_dir, mask_dir, names):
    sift = cv2.SIFT_create(nfeatures=12000, contrastThreshold=0.02)
    result = []
    for name in names:
        image = cv2.imread(str(image_dir / name), cv2.IMREAD_GRAYSCALE)
        mask = cv2.imread(str(mask_dir / (name + ".png")), cv2.IMREAD_GRAYSCALE)
        keys, descriptors = sift.detectAndCompute(image, mask)
        # RootSIFT: L1 normalisation followed by square root; COLMAP uses L1_ROOT too.
        descriptors /= np.maximum(descriptors.sum(axis=1, keepdims=True), 1e-12)
        descriptors = np.sqrt(descriptors)
        result.append((name, np.float32([key.pt for key in keys]), descriptors))
    return result


def visualize_pair(image_dir, mask_dir, left, right, points_a, points_b, mask, label, path):
    views, origins = [], []
    for name in [left, right]:
        original = Image.open(image_dir / name).convert("RGB")
        allowed = Image.open(mask_dir / (name + ".png")).convert("L")
        bbox = allowed.getbbox()
        bbox = (max(0, bbox[0] - 30), max(0, bbox[1] - 30), min(original.width, bbox[2] + 30), min(original.height, bbox[3] + 30))
        red = Image.blend(original, Image.new("RGB", original.size, (210, 40, 40)), 0.45)
        red.paste(original, mask=allowed)
        views.append(red.crop(bbox))
        origins.append(bbox[:2])
    canvas = Image.new("RGB", (views[0].width + views[1].width + 40, max(view.height for view in views) + 90), (25, 30, 35))
    positions = [(0, 65), (views[0].width + 40, 65)]
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 8), label, fill="white")
    draw.text((10, 27), "Fundamental-model inliers only; inlier does not prove a true 3D house point", fill="white")
    for view, pos in zip(views, positions):
        canvas.paste(view, pos)
    for number, (a, b, keep) in enumerate(zip(points_a, points_b, mask)):
        if not keep:
            continue
        p = tuple(float(a[k] - origins[0][k] + positions[0][k]) for k in range(2))
        q = tuple(float(b[k] - origins[1][k] + positions[1][k]) for k in range(2))
        color = [(70, 240, 160), (255, 210, 70), (80, 190, 255), (255, 100, 230)][number % 4]
        draw.line([p, q], fill=color, width=1)
        for x, y in [p, q]:
            draw.ellipse([x - 4, y - 4, x + 4, y + 4], outline=color, width=2)
            draw.text((x + 5, y - 12), str(number), fill=color)
    canvas.save(path)


def audit_pair(a, b, ratio):
    matcher = cv2.BFMatcher(cv2.NORM_L2)
    forward = matcher.knnMatch(a[2], b[2], k=2)
    reverse = matcher.knnMatch(b[2], a[2], k=2)
    matches = [m for m, n in forward if m.distance < ratio * n.distance and reverse[m.trainIdx][0].trainIdx == m.queryIdx]
    descriptor_norm = 512 if np.max(a[2]) > 2 else 1
    symmetric = [m for m in matches if reverse[m.trainIdx][0].distance < ratio * reverse[m.trainIdx][1].distance
        and m.distance <= 0.7 * descriptor_norm]
    p = np.float32([a[1][m.queryIdx] for m in matches]).reshape(-1, 2)
    q = np.float32([b[1][m.trainIdx] for m in matches]).reshape(-1, 2)
    F, fm = None, np.zeros(len(matches), bool)
    H, hm = None, np.zeros(len(matches), bool)
    cv2.setRNGSeed(0)
    if len(matches) >= 8:
        F, mask = cv2.findFundamentalMat(p, q, cv2.USAC_MAGSAC, 3.0, 0.999, 10000)
        if F is not None and mask is not None:
            fm = mask.ravel().astype(bool)
    if len(matches) >= 4:
        H, mask = cv2.findHomography(p, q, cv2.USAC_MAGSAC, 3.0, maxIters=10000, confidence=0.999)
        if H is not None and mask is not None:
            hm = mask.ravel().astype(bool)
    return {
        "images": [a[0], b[0]], "ratio": ratio, "mutual_matches": len(matches),
        "mutual_with_both_ratio_tests_and_07_distance": len(symmetric),
        "fundamental_inliers": int(fm.sum()), "homography_inliers": int(hm.sum()),
        "distinct_F_inlier_coordinate_pairs_rounded_1px": len({tuple(np.rint(np.concatenate([x, y])).astype(int)) for x, y, keep in zip(p, q, fm) if keep}),
        "fundamental_matrix": F.tolist() if F is not None else None,
        "homography_matrix": H.tolist() if H is not None else None,
        "matches": [{"left_xy_px": x.tolist(), "right_xy_px": y.tolist(), "fundamental_inlier": bool(f), "homography_inlier": bool(h)} for x, y, f, h in zip(p, q, fm, hm)],
    }, p, q, fm


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run", help="Existing COLMAP run directory with images, masks and database.db")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run, output = Path(args.run), Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    image_dir, mask_dir = run / "images", run / "masks"
    methods = {"colmap_descriptors_independent_bf": read_colmap(run / "database.db")}
    methods["opencv_rootsift"] = features_opencv(image_dir, mask_dir, [entry[0] for entry in next(iter(methods.values()))])
    report = {
        "generated_utc": datetime.now(timezone.utc).isoformat(), "opencv": cv2.__version__,
        "source_run": str(run), "status": "matching_diagnostic_only", "reconstructed_points": 0,
        "parameters": {"mutual_nearest_neighbor": True, "diagnostic_ratio_test": "forward only; symmetric ratio and max-distance pass count also reported separately", "ratios": [0.7, 0.8, 0.85, 0.9], "geometry": "USAC_MAGSAC", "geometry_threshold_px": 3, "confidence": 0.999, "iterations": 10000, "opencv_sift_contrast_threshold": 0.02, "opencv_sift_max_features": 12000},
        "limitations": ["Ratio 0.9 is exploratory and admits ambiguous matches", "Fundamental inliers may be repeated tiles, planar degeneracies or foliage; visuals must be inspected", "Two-view matches do not establish a usable three-view reconstruction or metric accuracy"],
        "methods": {},
    }
    for method, entries in methods.items():
        results = []
        print(method, "features", [len(entry[1]) for entry in entries], flush=True)
        for (index, a), (other_index, b) in itertools.combinations(enumerate(entries), 2):
            for ratio in report["parameters"]["ratios"]:
                result, p, q, fm = audit_pair(a, b, ratio)
                results.append(result)
                if ratio in (0.8, 0.85):
                    filename = f"{method}-pair{index + 1}-{other_index + 1}-ratio{ratio}.png"
                    visualize_pair(image_dir, mask_dir, a[0], b[0], p, q, fm, f"{method}, pair {index + 1}-{other_index + 1}, ratio {ratio}, F inliers {int(fm.sum())}/{len(p)}", output / filename)
                    result["visualization"] = filename
                print(index + 1, other_index + 1, ratio, result["mutual_matches"], result["fundamental_inliers"], result["homography_inliers"], flush=True)
        report["methods"][method] = {"features": [{"image": entry[0], "count": len(entry[1])} for entry in entries], "pairs": results}
    (output / "matching-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
