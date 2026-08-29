import importlib
import os
import pathlib
import sys
import types
import unittest
from unittest.mock import patch


PYTHON_SERVER_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_SERVER_ROOT))
fake_dotenv = types.ModuleType("dotenv")
fake_dotenv.load_dotenv = lambda: None
sys.modules.setdefault("dotenv", fake_dotenv)
config_module = importlib.import_module("config")


class VectorIndexConfigTests(unittest.TestCase):
    def test_valid_versioned_indexes_are_loaded(self):
        value = '{"v2":{"url":"https://example.test","token":"secret","hybrid":true}}'
        with patch.dict(os.environ, {"VECTOR_INDEXES_JSON": value}):
            indexes = config_module._load_vector_indexes()
        self.assertTrue(indexes["v2"]["hybrid"])

    def test_string_hybrid_flag_is_rejected(self):
        value = '{"v2":{"url":"https://example.test","token":"secret","hybrid":"false"}}'
        with patch.dict(os.environ, {"VECTOR_INDEXES_JSON": value}):
            with self.assertRaises(RuntimeError):
                config_module._load_vector_indexes()

    def test_invalid_version_is_rejected(self):
        value = '{"bad version":{"url":"https://example.test","token":"secret"}}'
        with patch.dict(os.environ, {"VECTOR_INDEXES_JSON": value}):
            with self.assertRaises(RuntimeError):
                config_module._load_vector_indexes()


if __name__ == "__main__":
    unittest.main()
