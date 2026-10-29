# Multi-stage / optimized slim image for FFmpeg & Python media services
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable live log streaming
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install system dependencies: FFmpeg, libgl1 for OpenCV/PySceneDetect, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY backend/ ./backend/
COPY frontend/dist/ ./frontend/dist/

# Pre-create data directories with appropriate permissions
RUN mkdir -p data/uploads data/outputs data/temp

# Expose default port
EXPOSE 8000

# Start Uvicorn bound to 0.0.0.0 and dynamically bind to $PORT provided by Render/Cloud platforms
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
