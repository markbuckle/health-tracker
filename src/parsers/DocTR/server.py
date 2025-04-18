#!/usr/bin/env python3
"""
DocTR Document Processing Server

This server provides an API endpoint for processing documents with DocTR,
a deep learning-based OCR system.
"""

import os
import io
import sys
import tempfile
import logging
from typing import Optional, List, Dict, Any

import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from PIL import Image
import cv2
import pdf2image
import torch

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="DocTR Document Processing API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DocTR models
try:
    # Import DocTR libraries
    from doctr.io import DocumentFile
    from doctr.models import ocr_predictor

    # Use CUDA if available
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")

    # Load models
    logger.info("Loading DocTR models...")
    predictor = ocr_predictor(pretrained=True).to(device)
    logger.info("DocTR models loaded successfully")
except ImportError:
    logger.error("Failed to import DocTR. Please install it with: pip install python-doctr")
    predictor = None
except Exception as e:
    logger.error(f"Error initializing DocTR models: {e}")
    predictor = None

class OCRResponse(BaseModel):
    """Response model for OCR results"""
    text: str
    confidence: float
    words: List[Dict[str, Any]] = []
    pages: int = 1

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "DocTR Document Processing API. POST to /process_document to analyze documents."}

@app.get("/status")
async def status():
    """Check service status"""
    return {
        "status": "ok" if predictor is not None else "error",
        "device": str(device) if predictor is not None else "N/A",
        "message": "DocTR service is running" if predictor is not None else "DocTR failed to initialize"
    }

def process_pdf(file_content: bytes) -> tuple:
    """
    Process PDF file using DocTR
    
    Args:
        file_content: PDF file content as bytes
        
    Returns:
        tuple: (extracted text, confidence score, word details, number of pages)
    """
    # Save the content to a temporary file
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
        temp_file.write(file_content)
        temp_path = temp_file.name
    
    try:
        # Load document using DocTR's DocumentFile
        doc = DocumentFile.from_pdf(temp_path)
        
        # Process with OCR
        result = predictor(doc)
        
        # Extract text and confidence
        full_text = result.export()["text"]
        confidence = float(np.mean([page.score for page in result.pages]))
        
        # Get detailed word information
        word_details = []
        for page_idx, page in enumerate(result.pages):
            for block in page.blocks:
                for line in block.lines:
                    for word in line.words:
                        word_details.append({
                            "text": word.value,
                            "confidence": float(word.confidence),
                            "bbox": word.geometry,
                            "page": page_idx
                        })
        
        return full_text, confidence, word_details, len(result.pages)
    
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)

def process_image(file_content: bytes) -> tuple:
    """
    Process image file using DocTR
    
    Args:
        file_content: Image file content as bytes
        
    Returns:
        tuple: (extracted text, confidence score, word details)
    """
    # Convert bytes to image
    image = Image.open(io.BytesIO(file_content))
    
    # Load document
    doc = DocumentFile.from_images(np.array(image))
    
    # Process with OCR
    result = predictor(doc)
    
    # Extract text and confidence
    full_text = result.export()["text"]
    confidence = float(np.mean([page.score for page in result.pages]))
    
    # Get detailed word information
    word_details = []
    for page_idx, page in enumerate(result.pages):
        for block in page.blocks:
            for line in block.lines:
                for word in line.words:
                    word_details.append({
                        "text": word.value,
                        "confidence": float(word.confidence),
                        "bbox": word.geometry,
                        "page": page_idx
                    })
    
    return full_text, confidence, word_details, 1

@app.post("/process_document", response_model=OCRResponse)
async def process_document(file: UploadFile = File(...)):
    """
    Process a document (PDF or image) using DocTR
    
    Args:
        file: Uploaded file (PDF or image)
        
    Returns:
        OCRResponse: Extracted text and confidence
    """
    if predictor is None:
        raise HTTPException(status_code=500, detail="OCR service not properly initialized")
    
    try:
        # Read file content
        file_content = await file.read()
        
        # Check file type and process accordingly
        file_extension = os.path.splitext(file.filename)[1].lower()
        
        logger.info(f"Processing {file.filename} ({file_extension})")
        
        if file_extension == '.pdf':
            full_text, confidence, word_details, num_pages = process_pdf(file_content)
        elif file_extension in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif']:
            full_text, confidence, word_details, num_pages = process_image(file_content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF or image file.")
        
        logger.info(f"Processed document with {len(word_details)} words across {num_pages} pages. Confidence: {confidence:.2f}")
        
        return OCRResponse(
            text=full_text,
            confidence=confidence,
            words=word_details,
            pages=num_pages
        )
    
    except Exception as e:
        logger.error(f"Error processing document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

if __name__ == "__main__":
    # Get port from environment variable or use default
    port = int(os.environ.get("PORT", 8000))
    
    # Run the server
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)