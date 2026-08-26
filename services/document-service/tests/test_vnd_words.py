from app.render.vnd_words import vnd_to_vietnamese_document_line


def test_reads_three_digit_groups():
    text = vnd_to_vietnamese_document_line(103_324_000)
    assert "undefined" not in text
    assert text == "Một trăm linh ba triệu ba trăm hai mươi bốn nghìn đồng"


def test_zero_padded_lower_groups():
    text = vnd_to_vietnamese_document_line(1_024_000)
    assert text == "Một triệu không trăm hai mươi bốn nghìn đồng"


def test_zero():
    assert vnd_to_vietnamese_document_line(0) == "Không đồng"


def test_invalid_returns_empty():
    assert vnd_to_vietnamese_document_line(None) == ""
    assert vnd_to_vietnamese_document_line(-1) == ""


def test_rounding_matches_js_math_round():
    assert vnd_to_vietnamese_document_line(0.5) == "Một đồng"
    assert vnd_to_vietnamese_document_line(2.5) == "Ba đồng"


def test_non_finite_returns_empty():
    assert vnd_to_vietnamese_document_line(float("inf")) == ""
    assert vnd_to_vietnamese_document_line("inf") == ""


def test_hex_string_matches_js_number():
    assert vnd_to_vietnamese_document_line("0x10") == vnd_to_vietnamese_document_line(16)
    assert vnd_to_vietnamese_document_line("0x10") == "Mười sáu đồng"


def test_numeric_separator_string_invalid():
    assert vnd_to_vietnamese_document_line("1_000") == ""
