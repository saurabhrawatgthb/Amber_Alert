FROM python:3.10-slim

# System dependencies for OpenCV, dlib (face_recognition), InsightFace, and build tools
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    build-essential \
    cmake \
    git \
    wget \
    curl \
    # dlib / face_recognition dependencies
    libboost-python-dev \
    libboost-thread-dev \
    libboost-all-dev \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch CPU-only (smaller, faster build for hackathon CPU environment)
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install dlib first (face_recognition dependency, requires compilation)
RUN pip install --no-cache-dir dlib

# Install deep-sort-realtime
RUN pip install --no-cache-dir deep-sort-realtime

# Optional: OSNet via torchreid (fails gracefully if unavailable)
RUN pip install --no-cache-dir git+https://github.com/KaiyangZhou/deep-person-reid.git || \
    echo "WARNING: torchreid install failed — OSNet re-id will be disabled"

# Copy and install remaining Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy AI application code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Launch
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
