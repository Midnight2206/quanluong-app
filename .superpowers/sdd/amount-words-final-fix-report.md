## 2026-08-26 final fix pass

- Critical: guarded `vnd_to_vietnamese_document_line` so values `>= 10**12` return `""` instead of overflowing `_UNITS`.
- Important: `resolve_document_amount` now only sums row data when the detected column key is a real money key from `_AMOUNT_KEYS`, so non-money fallback columns no longer produce `"Không đồng"`.
- Optional #3: moved `try_parse_amount` into `carry_totals.py` and made `parse_amount` delegate to it to keep parsing logic in one place.

### Tests

```text
$ ./services/document-service/.venv/bin/pytest services/document-service/tests/test_vnd_words.py services/document-service/tests/test_amount_in_words.py services/document-service/tests/test_pdf_renderer.py services/document-service/tests/test_carry_totals.py -q
.....................................                                    [100%]
37 passed in 0.20s
```
