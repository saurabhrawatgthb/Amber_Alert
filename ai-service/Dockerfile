FROM python:3.10-slim

# Install system dependencies required for OpenCV, PyTorch, and compiling C++ wheels
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
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip and install heavy tensor libraries first to utilize caching
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install deep-sort and torchreid via Git (Requires compilation)
RUN pip install --no-cache-dir deep-sort-realtime
RUN pip install --no-cache-dir git+https://github.com/KaiyangZhou/deep-person-reid.git || \
    echo "WARNING: torchreid install failed, OSNet re-id will be disabled"

# Copy requirements and install the remaining Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the actual AI application code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run the FastAPI server via Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
