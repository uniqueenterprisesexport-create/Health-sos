"""Actual OpenCV image-quality analysis. No diagnosis or clinical inference.
Reads one JSON object from stdin. Images are processed in memory, never saved.
"""
import base64
import json
import sys
import os
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", "24000000")
import cv2
import numpy as np

def analyze(image):
    raw = base64.b64decode(image.split(',', 1)[1], validate=True)
    if len(raw) > 5 * 1024 * 1024:
        raise ValueError('Image exceeds 5 MB')
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError('Image could not be decoded')
    height, width = image.shape[:2]
    if height * width > 24_000_000:
        raise ValueError('Image exceeds 24 megapixels')
    scaled = cv2.resize(image, (640, max(1, round(height * 640 / width)))) if width > 640 else image
    gray = cv2.cvtColor(scaled, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    edges = cv2.Canny(gray, 60, 140)
    edge_density = float(np.count_nonzero(edges) / edges.size)
    warnings = []
    if brightness < 45: warnings.append('Low light: move to better lighting if safe.')
    if brightness > 225: warnings.append('Overexposed: reduce glare if safe.')
    if sharpness < 60: warnings.append('Low detail or blur: hold the camera steady if safe.')
    return {'engine': 'OpenCV Python ' + cv2.__version__, 'width': width, 'height': height,
            'brightness': round(brightness, 1), 'sharpness': round(sharpness, 1),
            'edgeDensity': round(edge_density, 4), 'warnings': warnings,
            'clinicalAssessment': False, 'imageSaved': False,
            'note': 'Image quality only. These thresholds are engineering heuristics, not medically validated.'}

if __name__ == '__main__':
    try:
        payload = json.load(sys.stdin)
        print(json.dumps(analyze(payload['image'])))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
