# /api/ocr/Dockerfile
FROM python:3.9-slim

# Install system dependencies for PaddleOCR
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgcc-s1 \
    libgl1-mesa-glx \
    libgthread-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    paddlepaddle==2.6.0 \
    paddleocr==2.7.0.3 \
    PyMuPDF==1.23.26

# Copy the Python script
COPY process.py .

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Expose port (Vercel will handle this)
EXPOSE 8080

# Command to run the application
CMD ["python", "process.py"]