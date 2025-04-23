#!/usr/bin/env python3
import sys
import os
import json
import tempfile
from pathlib import Path
import traceback

# Import OCR libraries
try:
    import easyocr
    import fitz  # PyMuPDF
    import numpy as np
    from PIL import Image
except ImportError as e:
    print(f"Error: Required library not installed: {e}", file=sys.stderr)
    print(json.dumps({
        "error": f"Required library not installed: {e}",
        "traceback": traceback.format_exc()
    }))
    sys.exit(1)

def get_reader(languages=['en']):
    """Initialize the EasyOCR reader with specified languages"""
    print(f"Languages: {languages}", file=sys.stderr)
    
    # Check if GPU is available
    import torch
    gpu = torch.cuda.is_available()
    print(f"GPU enabled: {gpu}", file=sys.stderr)
    
    try:
        print(f"Initializing EasyOCR with languages: {languages}")
        return easyocr.Reader(languages, gpu=gpu)
    except Exception as e:
        print(f"Error initializing EasyOCR: {e}", file=sys.stderr)
        raise

def process_image(image_path, reader=None):
    """Process a single image with EasyOCR"""
    if reader is None:
        reader = get_reader()
    
    try:
        # Read the image
        if isinstance(image_path, np.ndarray):
            # If it's already a numpy array (from PDF processing)
            img = image_path
        else:
            img = image_path
        
        # Perform OCR
        results = reader.readtext(img)
        
        # Extract text and confidence
        full_text = ""
        word_details = []
        total_confidence = 0
        
        for bbox, text, confidence in results:
            if text.strip():
                full_text += text + " "
                word_details.append({
                    "text": text,
                    "confidence": confidence,
                    "bbox": bbox
                })
                total_confidence += confidence
        
        # Calculate average confidence
        avg_confidence = total_confidence / len(results) if results else 0
        
        return full_text.strip(), word_details, avg_confidence
    
    except Exception as e:
        print(f"Error processing image: {e}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        raise

def process_pdf(pdf_path, reader=None):
    """Process a PDF file page by page with EasyOCR"""
    if reader is None:
        reader = get_reader()
    
    try:
        print(f"Processing PDF: {pdf_path}")
        
        # Open the PDF
        pdf_document = fitz.open(pdf_path)
        num_pages = len(pdf_document)
        
        all_text = ""
        all_words = []
        total_confidence = 0
        total_results = 0
        
        # Process each page
        for page_num in range(num_pages):
            try:
                print(f"Processing page {page_num + 1}/{num_pages}")
                
                # Get the page
                page = pdf_document[page_num]
                
                # Convert to image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better OCR
                
                # Save to a temporary file
                fd, temp_path = tempfile.mkstemp(suffix='.png')
                os.close(fd)  # Close the file descriptor
                
                # Use a try-finally block to ensure cleanup
                try:
                    # Convert PyMuPDF pixmap to bytes
                    pix.save(temp_path)
                    
                    # Process the image
                    page_text, page_words, page_confidence = process_image(temp_path, reader)
                    
                    if page_text:
                        all_text += page_text + "\n\n"
                        all_words.extend(page_words)
                        total_confidence += page_confidence * len(page_words)
                        total_results += len(page_words)
                finally:
                    # Clean up the temporary file
                    try:
                        if os.path.exists(temp_path):
                            os.unlink(temp_path)
                    except Exception as e:
                        print(f"Warning: Failed to delete temporary file: {e}", file=sys.stderr)
            
            except Exception as e:
                print(f"Error processing page {page_num + 1}: {e}", file=sys.stderr)
                print(traceback.format_exc(), file=sys.stderr)
                # Continue with other pages despite errors
        
        # Close the PDF
        pdf_document.close()
        
        # Calculate overall confidence
        avg_confidence = total_confidence / total_results if total_results > 0 else 0
        
        return all_text.strip(), all_words, avg_confidence
        
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        raise Exception(f"Failed to process PDF: {str(e)}")

if __name__ == "__main__":
    # Check arguments
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Missing input file path",
            "usage": "python run_easyocr.py <file_path>"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    print(f"Processing file: {input_path}")
    
    if not os.path.exists(input_path):
        print(json.dumps({
            "error": f"File not found: {input_path}"
        }))
        sys.exit(1)
    
    try:
        # Initialize reader
        reader = get_reader(['en'])
        
        # Check file type and process accordingly
        if input_path.lower().endswith('.pdf'):
            text, words, confidence = process_pdf(input_path, reader)
        else:
            # Assume it's an image
            text, words, confidence = process_image(input_path, reader)
        
        # Return the results as JSON
        print(json.dumps({
            "text": text,
            "words": words,
            "confidence": confidence
        }))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)
