FROM python:3.9-slim

WORKDIR /app

# Install system dependencies required for DocTR and pdf2image
RUN apt-get update && apt-get install -y \
    poppler-utils \
    libpoppler-cpp-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the server code
COPY server.py .

# Expose the port the app will run on
EXPOSE 8000

# Command to run the app
CMD ["python", "server.py"]