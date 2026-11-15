FROM python:3.12-alpine

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN sed -i 's|https://dl-cdn.alpinelinux.org/alpine|https://dl-4.alpinelinux.org/alpine|g' /etc/apk/repositories \
    && apk update \
    && apk upgrade --no-cache

RUN adduser -D -u 10001 appuser \
    && mkdir -p /app/instance \
    && chown -R appuser:appuser /app

COPY requirements.txt .
COPY wheelhouse/ /wheelhouse/

RUN pip install --no-cache-dir --no-index \
    --find-links=/wheelhouse \
    -r requirements.txt \
    && rm -rf /wheelhouse

COPY --chown=appuser:appuser app.py .

USER 10001
EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--access-logfile", "-", "app:app"]
