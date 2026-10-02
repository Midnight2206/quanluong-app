FROM postgres:16-bookworm

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    cron \
    curl \
    mariadb-client \
    rclone \
    tzdata \
    zstd \
  && rm -rf /var/lib/apt/lists/*

COPY backup.sh entrypoint.sh /opt/backup/
COPY crontab /etc/cron.d/quanluong-backup
RUN chmod 755 /opt/backup/backup.sh /opt/backup/entrypoint.sh \
  && chmod 644 /etc/cron.d/quanluong-backup

ENTRYPOINT ["/opt/backup/entrypoint.sh"]
