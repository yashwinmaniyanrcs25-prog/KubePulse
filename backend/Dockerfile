FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app ./app

# Set non-root user
RUN groupadd -g 10002 kubepulse && \
    useradd -u 10002 -g kubepulse -s /bin/sh -m kubepulse && \
    chown -R kubepulse:kubepulse /app

USER 10002:10002

ENV PYTHONUNBUFFERED=1
ENV KUBEPULSE_HOST=0.0.0.0
ENV KUBEPULSE_PORT=8080

EXPOSE 8080

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
