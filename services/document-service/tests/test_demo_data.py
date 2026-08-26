from app.documents.demo_data import build_bien_ban_test_v2_demo


def test_build_bien_ban_test_v2_demo_has_45_rows_by_default():
    payload = build_bien_ban_test_v2_demo()
    assert payload["demo_key"] == "bien_ban_test_v2"
    assert len(payload["rows"]) == 45
    assert payload["rows"][0]["tt"] == "1"
    assert "ten_quy_cach_pham_chat_vat_tu_hang_hoa_dung_cu" in payload["rows"][0]
    assert payload["rows"][-1]["tt"] == "45"


def test_build_bien_ban_test_v2_demo_custom_row_count():
    payload = build_bien_ban_test_v2_demo(row_count=3)
    assert len(payload["rows"]) == 3
