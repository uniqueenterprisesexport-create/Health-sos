import base64
import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'vision'))
from analyze import analyze
import cv2
import numpy as np

def data_url(image):
    ok, raw = cv2.imencode('.png',image)
    assert ok
    return 'data:image/png;base64,'+base64.b64encode(raw).decode()

class VisionTests(unittest.TestCase):
    def test_dark_frame(self):
        r=analyze(data_url(np.zeros((240,320,3),np.uint8)))
        self.assertEqual(r['brightness'],0)
        self.assertTrue(any('Low light' in x for x in r['warnings']))
        self.assertFalse(r['clinicalAssessment'])
        self.assertFalse(r['imageSaved'])
    def test_checkerboard_has_detail(self):
        gray=((np.indices((240,320)).sum(axis=0)//12)%2*160+45).astype(np.uint8)
        r=analyze(data_url(cv2.cvtColor(gray,cv2.COLOR_GRAY2BGR)))
        self.assertGreater(r['sharpness'],60)
        self.assertGreater(r['edgeDensity'],0)
    def test_bad_image(self):
        with self.assertRaises(Exception):analyze('data:image/png;base64,bm90IGFuIGltYWdl')

if __name__=='__main__': unittest.main()
