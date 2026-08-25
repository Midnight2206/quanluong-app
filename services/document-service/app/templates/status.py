STATUS_DRAFT = "draft"
STATUS_PUBLISHED = "published"
STATUS_RETIRED = "retired"
TEMPLATE_STATUSES = (STATUS_DRAFT, STATUS_PUBLISHED, STATUS_RETIRED)


class TemplateStatusError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def is_published(status: str) -> bool:
    return status == STATUS_PUBLISHED


def publish_template(_session, template):
    if template.status != STATUS_DRAFT:
        raise TemplateStatusError(
            "TEMPLATE_NOT_DRAFT", "Chỉ mẫu nháp mới được publish"
        )
    template.status = STATUS_PUBLISHED
    return template


def retire_template(_session, template):
    if template.status == STATUS_RETIRED:
        raise TemplateStatusError("TEMPLATE_ALREADY_RETIRED", "Mẫu đã ngừng dùng")
    if template.status not in (STATUS_DRAFT, STATUS_PUBLISHED):
        raise TemplateStatusError(
            "TEMPLATE_STATUS_INVALID", "Không retire được trạng thái này"
        )
    template.status = STATUS_RETIRED
    return template
