class TemplateValidationError(Exception):
    """Template Named Range / structure validation failure."""


class TemplateExistsError(Exception):
    """Template with the same name and version already exists."""

    def __init__(self, name: str, version: str) -> None:
        self.name = name
        self.version = version
        super().__init__(f"Mẫu «{name}» phiên bản «{version}» đã tồn tại")
