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

def process_pdf(file_content):
    """Process a PDF file with DocTR."""
    try:
        # Save the file content to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp:
            temp.write(file_content)
            temp_path = temp.name
        
        logger.info(f"Created temporary file at {temp_path}")
        
        # Process with DocTR
        logger.info("Loading document with DocumentFile.from_pdf")
        doc = DocumentFile.from_pdf(temp_path)
        logger.info(f"Document loaded: {type(doc)} with {len(doc)} page(s)")
        
        logger.info("Running OCR prediction")
        result = predictor(doc)
        logger.info(f"Prediction result type: {type(result)}")
        
        # Debug the result structure
        exported = result.export()
        logger.info(f"Export result type: {type(exported)}")
        logger.info(f"Export result keys: {list(exported.keys()) if isinstance(exported, dict) else 'Not a dict'}")
        
        # Try different approaches to get the text
        if isinstance(exported, dict) and 'text' in exported:
            full_text = exported['text']
        elif hasattr(result, 'text'):
            full_text = result.text
        elif hasattr(result, 'get_text'):
            full_text = result.get_text()
        else:
            # If we can't get text directly, reconstruct it from pages/blocks/lines/words
            full_text = ""
            for page in result.pages:
                page_text = ""
                for block in page.blocks:
                    for line in block.lines:
                        line_text = " ".join([word.value for word in line.words])
                        page_text += line_text + " "
                full_text += page_text.strip() + "\n\n"
        
        logger.info(f"Extracted text length: {len(full_text)}")
        
        # Calculate average confidence and word details
        word_details = []
        total_confidence = 0
        word_count = 0
        
        for page_idx, page in enumerate(result.pages):
            for block_idx, block in enumerate(page.blocks):
                for line_idx, line in enumerate(block.lines):
                    for word_idx, word in enumerate(line.words):
                        try:
                            word_detail = {
                                "text": word.value,
                                "confidence": float(word.confidence),
                                "box": [
                                    [float(word.geometry[0][0]), float(word.geometry[0][1])],
                                    [float(word.geometry[1][0]), float(word.geometry[1][1])]
                                ],
                                "page": page_idx
                            }
                            word_details.append(word_detail)
                            total_confidence += word.confidence
                            word_count += 1
                        except Exception as e:
                            logger.error(f"Error processing word: {str(e)}")
        
        confidence = total_confidence / word_count if word_count > 0 else 0
        logger.info(f"Processed {word_count} words with average confidence {confidence:.2f}")
        
        # Clean up
        os.unlink(temp_path)
        logger.info(f"Temporary file {temp_path} removed")
        
        return full_text, confidence, word_details, len(result.pages)
    
    except Exception as e:
        logger.error(f"Error in process_pdf: {str(e)}")
        logger.exception("Detailed traceback:")
        raise

def process_image(file_content):
    """Process an image file with DocTR."""
    try:
        # Save the file content to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp:
            temp.write(file_content)
            temp_path = temp.name
        
        logger.info(f"Created temporary file at {temp_path}")
        
        # Process with DocTR
        logger.info("Loading document with DocumentFile.from_images")
        doc = DocumentFile.from_images(temp_path)
        logger.info(f"Document loaded: {type(doc)} with {len(doc)} page(s)")
        
        logger.info("Running OCR prediction")
        result = predictor(doc)
        logger.info(f"Prediction result type: {type(result)}")
        
        # Debug the result structure
        exported = result.export()
        logger.info(f"Export result type: {type(exported)}")
        logger.info(f"Export result keys: {list(exported.keys()) if isinstance(exported, dict) else 'Not a dict'}")
        
        # Try different approaches to get the text
        if isinstance(exported, dict) and 'text' in exported:
            full_text = exported['text']
        elif hasattr(result, 'text'):
            full_text = result.text
        elif hasattr(result, 'get_text'):
            full_text = result.get_text()
        else:
            # If we can't get text directly, reconstruct it from pages/blocks/lines/words
            full_text = ""
            for page in result.pages:
                page_text = ""
                for block in page.blocks:
                    for line in block.lines:
                        line_text = " ".join([word.value for word in line.words])
                        page_text += line_text + " "
                full_text += page_text.strip() + "\n\n"
        
        logger.info(f"Extracted text length: {len(full_text)}")
        
        # Calculate average confidence and word details
        word_details = []
        total_confidence = 0
        word_count = 0
        
        for page_idx, page in enumerate(result.pages):
            for block_idx, block in enumerate(page.blocks):
                for line_idx, line in enumerate(block.lines):
                    for word_idx, word in enumerate(line.words):
                        try:
                            word_detail = {
                                "text": word.value,
                                "confidence": float(word.confidence),
                                "box": [
                                    [float(word.geometry[0][0]), float(word.geometry[0][1])],
                                    [float(word.geometry[1][0]), float(word.geometry[1][1])]
                                ],
                                "page": page_idx
                            }
                            word_details.append(word_detail)
                            total_confidence += word.confidence
                            word_count += 1
                        except Exception as e:
                            logger.error(f"Error processing word: {str(e)}")
        
        confidence = total_confidence / word_count if word_count > 0 else 0
        logger.info(f"Processed {word_count} words with average confidence {confidence:.2f}")
        
        # Clean up
        os.unlink(temp_path)
        logger.info(f"Temporary file {temp_path} removed")
        
        return full_text, confidence, word_details, len(result.pages)
    
    except Exception as e:
        logger.error(f"Error in process_image: {str(e)}")
        logger.exception("Detailed traceback:")
        raise
    
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