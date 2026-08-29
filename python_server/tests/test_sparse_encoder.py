import pathlib
import sys
import unittest


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))

from models.sparse_encoder import HashingSparseEncoder


class SparseEncoderTests(unittest.TestCase):
    def test_encoding_is_deterministic_and_sorted(self):
        encoder = HashingSparseEncoder(100_003)
        first = encoder.encode("Error API-123 API-123 v2.1.0")
        second = encoder.encode("Error API-123 API-123 v2.1.0")
        self.assertEqual(first, second)
        self.assertEqual(first.indices, sorted(first.indices))
        self.assertAlmostEqual(sum(value * value for value in first.values), 1.0)

    def test_empty_content_produces_empty_vector(self):
        self.assertEqual(HashingSparseEncoder().encode("---").indices, [])
