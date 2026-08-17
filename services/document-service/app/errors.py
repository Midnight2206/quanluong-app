def error_detail(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def value_error_detail(exc: ValueError) -> dict:
    return error_detail("BAD_REQUEST", str(exc))
