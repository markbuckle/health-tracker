# DocTR OCR Implementation for HealthLync

This directory contains a DocTR-based implementation for processing medical lab documents. [DocTR](https://github.com/mindee/doctr) is a powerful OCR library that uses deep learning models to extract text from documents with higher accuracy than traditional OCR tools like Tesseract.

## Overview

The implementation consists of:

1. **labParser.js** - NodeJS module that interacts with the DocTR server and extracts lab values
2. **server.py** - Python FastAPI server that runs DocTR and provides an API endpoint for document processing
3. **requirements.txt** - Python dependencies for the DocTR server
4. **Dockerfile** - Container definition for running the DocTR server

This implementation reuses the pattern definitions in `src/parser/labPatterns.js` to maintain consistency with the PyTesseract implementation.

## Setup Instructions

### Option 1: Running with Docker (Recommended)

1. Build the Docker image:
   ```
   cd src/parsers/DocTR
   docker build -t doctr-server .
   ```

2. Run the Docker container:
   ```
   docker run -p 8000:8000 doctr-server
   ```

### Option 2: Running Directly with Python

1. Install Python 3.9+ and required system dependencies:
   ```
   # Ubuntu/Debian
   sudo apt-get update && sudo apt-get install -y poppler-utils libpoppler-cpp-dev libgl1-mesa-glx
   
   # macOS
   brew install poppler
   ```

2. Install Python dependencies:
   ```
   cd src/parser/DocTR
   pip install -r requirements.txt
   ```

3. Run the server:
   ```
   python server.py
   ```

## Configuration

The following environment variables can be set to customize the behavior:

- `PORT` - Port for the DocTR server (default: 8000)
- `DEBUG_OCR` - Set to "true" to enable detailed logging (default: false)
- `DOCTR_API_URL` - URL of the DocTR server (default: http://localhost:8000/process_document)

## Usage in Your Application

Update your `.env` file to use the DocTR implementation instead of PyTesseract:

```
OCR_IMPLEMENTATION=DocTR
DOCTR_API_URL=http://localhost:8000/process_document
```

Then modify your main application code to use the appropriate implementation:

```javascript
// In your file upload handler
const implementation = process.env.OCR_IMPLEMENTATION || 'PyTesseract';
const { extractFromPDF } = require(`./parser/${implementation}/labParser`);

// Use the extractFromPDF function as before
const extractedData = await extractFromPDF(file.path);
```

## Benefits over Tesseract

- Higher accuracy for structured documents
- Better handling of document layout
- More context-aware text extraction
- Faster processing for multi-page documents
- More robust to low-quality scans and images

## Performance Considerations

DocTR requires more computational resources than Tesseract. If you're running on a system with limited resources, you may want to adjust the Docker container resources or stick with the PyTesseract implementation.

For optimal performance, a system with a GPU is recommended, but DocTR will automatically fall back to CPU processing if no GPU is available.