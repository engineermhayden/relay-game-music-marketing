FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends libgdal32 libgeos-c1v5 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY shared/ /shared/
COPY marketing/sample-songs/ /sample-songs/
ENV SAMPLE_SONGS_DIR=/sample-songs
RUN mkdir -p /app/media /app/staticfiles && useradd --system --uid 10001 relay && chown -R relay:relay /app
USER relay
EXPOSE 8000
