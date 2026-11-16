from app.render.supplier_daily_invoice import _long_date, render_supplier_daily_invoice


def test_long_date_is_full_vietnamese():
    assert _long_date("2026-11-12") == "Ngày 12 tháng 11 năm 2026"
    assert _long_date("2026-01-03") == "Ngày 3 tháng 1 năm 2026"


def test_render_supplier_daily_invoice_returns_pdf_bytes():
    pdf = render_supplier_daily_invoice(
        {
            "date": "2026-11-16",
            "note": "Hoá đơn đã bao gồm thuế GTGT",
            "seller": {
                "name": "NCC Demo",
                "representativeName": "A",
                "taxCode": "0123",
                "phone": "090",
            },
            "buyer": {"name": "Đơn vị 1"},
            "lines": [
                {
                    "name": "Gạo",
                    "measureUnit": "kg",
                    "quantityFormatted": "2",
                    "unitPrice": 10000,
                    "amount": 20000,
                }
            ],
            "grandTotal": 20000,
        }
    )
    assert isinstance(pdf, (bytes, bytearray))
    assert pdf[:4] == b"%PDF"
