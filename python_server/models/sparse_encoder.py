import hashlib
import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import List


TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:[._:/-][a-z0-9]+)*", re.IGNORECASE)


@dataclass(frozen=True)
class SparseEncoding:
    indices: List[int]
    values: List[float]


class HashingSparseEncoder:
    """Stateless lexical encoder suitable for distributed ingestion workers.

    Feature hashing avoids an in-memory vocabulary or corpus rebuild. It is not
    BM25: Upstash applies sparse inner-product search to normalized, sublinear
    term-frequency weights. Exact identifiers and version strings are retained
    as tokens, which complements dense semantic retrieval.
    """

    def __init__(self, dimensions: int = 2_147_483_647):
        if dimensions < 1_024 or dimensions > 2_147_483_647:
            raise ValueError("Sparse hash dimensions must be between 1024 and 2^31-1")
        self.dimensions = dimensions

    def encode(self, text: str) -> SparseEncoding:
        counts = Counter(self._tokens(text))
        if not counts:
            return SparseEncoding([], [])

        features = Counter()
        for token, count in counts.items():
            features[self._index(token)] += 1.0 + math.log(count)

        norm = math.sqrt(sum(value * value for value in features.values()))
        ordered = sorted(features.items())
        return SparseEncoding(
            indices=[index for index, _ in ordered],
            values=[value / norm for _, value in ordered],
        )

    @staticmethod
    def _tokens(text: str) -> List[str]:
        tokens = []
        for match in TOKEN_PATTERN.findall(text.lower()):
            tokens.append(match)
            # Preserve the exact identifier and its meaningful components.
            if any(separator in match for separator in ".-_:/"):
                tokens.extend(part for part in re.split(r"[._:/-]+", match) if part)
        return tokens

    def _index(self, token: str) -> int:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        return int.from_bytes(digest, "big") % self.dimensions
