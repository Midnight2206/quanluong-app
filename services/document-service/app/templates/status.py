STATUS_DRAFT = "draft"
STATUS_PUBLISHED = "published"
STATUS_RETIRED = "retired"
TEMPLATE_STATUSES = (STATUS_DRAFT, STATUS_PUBLISHED, STATUS_RETIRED)


def is_published(status: str) -> bool:
    return status == STATUS_PUBLISHED
