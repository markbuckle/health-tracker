#!/usr/bin/env python3
"""
EasyOCR Document Processing Script

This script processes documents (PDF or image) using EasyOCR and returns the OCR results
as JSON for Node.js to process.
"""

import os
import sys
import json
import tempfile
import argparse
import uuid
from pathlib import Path
import traceback
import shutil

# Parse arguments
parser = argparse.ArgumentParser(description='Process documents with EasyOCR')
parser.add_argument('--input', type=str, required=True, help='Path to input document')
parser.add_argument('--output', type=str, help='Path to output JSON file (optional)')
parser.add_argument('--languages', type=str, default='en', help='Languages for OCR (comma-separated)')
parser.add_argument('--gpu', action='store_true', help='Use GPU for processing if available')
parser.add_argument('--debug', action='store_true', help='Enable debug mode')
parser.add_argument('--temp-dir', type=str, help='Custom temp directory path')
args = parser.parse_args()

# Set up debugging
DEBUG = args.debug
input_path = args.input
output_path = args.output
use_gpu = args.gpu
languages = args.languages.split(',')

# Use custom temp directory if provided, otherwise create one in the same directory as the input file
if args.temp_dir:
    temp_base_dir = args.temp_dir
else:
    temp_base_dir = os.path.dirname(input_path)

# Create a unique temp directory for this run
unique_id = uuid.uuid4().hex
temp_dir = os.path.join(temp_base_dir, f"easyocr_temp_{unique_id}")
os.makedirs(temp_dir, exist_ok=True)

if DEBUG:
    print(f"Processing file: {input_path}")
    print(f"Languages: {languages}")
    print(f"GPU enabled: {use_gpu}")
    print(f"Using temp directory: {temp_dir}")

try:
    # Import required libraries
    import numpy as np
    import cv2
    import easyocr
    import fitz  # PyMuPDF
    from PIL import Image
    
    # Check if the input is a PDF or an image
    input_extension = os.path.splitext(input_path)[1].lower()
    is_pdf = input_extension == '.pdf'
    is_image = not is_pdf
    
    # Initialize EasyOCR reader
    if DEBUG:
        print(f"Initializing EasyOCR with languages: {languages}")
    
    reader = easyocr.Reader(
        languages,
        gpu=use_gpu,
        detector=True,  # Use text detector
        recognizer=True,  # Use text recognizer
        verbose=DEBUG    # Print progress info if in debug mode
    )
    
    # Function to process images with EasyOCR
    def process_image(image_path):
        if DEBUG:
            print(f"Processing image: {image_path}")
        
        # Read the image
        try:
            img = cv2.imread(image_path)
            if img is None:
                # Try with PIL if OpenCV fails
                pil_img = Image.open(image_path)
                img = np.array(pil_img)
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise Exception(f"Failed to read image: {str(e)}")
        
        # Run OCR
        if DEBUG:
            print("Running EasyOCR...")
        
        results = reader.readtext(img)
        
        # Extract text and positions
        extracted_text = ""
        all_words = []
        
        for detection in results:
            bbox, text, confidence = detection
            
            # Skip low confidence results
            if confidence < 0.3:
                continue
                
            extracted_text += text + " "
            
            # Add word to detailed output
            all_words.append({
                "text": text,
                "confidence": confidence,
                "bbox": bbox,
            })
        
        return extracted_text.strip(), all_words, sum(word["confidence"] for word in all_words) / len(all_words) if all_words else 0
    
    # Function to process PDFs
    def process_pdf(pdf_path):
        if DEBUG:
            print(f"Processing PDF: {pdf_path}")
        
        try:
            # Open PDF document
            doc = fitz.open(pdf_path)
            
            full_text = ""
            all_words = []
            total_confidence = 0
            total_words = 0
            
            temp_files = []
            
            # Process each page
            for page_num in range(len(doc)):
                if DEBUG:
                    print(f"Processing page {page_num+1}/{len(doc)}")
                
                try:
                    # Get page
                    page = doc.load_page(page_num)
                    
                    # Render page to image
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better OCR
                    
                    # Save to a unique temporary file in our custom temp directory
                    temp_path = os.path.join(temp_dir, f"page_{page_num}.png")
                    pix.save(temp_path)
                    temp_files.append(temp_path)
                    
                    # Process the image
                    page_text, page_words, page_confidence = process_image(temp_path)
                    
                    # Add page number to words
                    for word in page_words:
                        word["page"] = page_num
                    
                    # Add to overall results
                    full_text += f"\n\n--- PAGE {page_num+1} ---\n\n" + page_text
                    all_words.extend(page_words)
                    
                    if page_words:
                        total_confidence += page_confidence
                        total_words += 1
                
                except Exception as e:
                    if DEBUG:
                        print(f"Error processing page {page_num+1}: {str(e)}")
                    # Continue with next page even if one fails
                    continue
            
            # Calculate average confidence
            avg_confidence = total_confidence / total_words if total_words > 0 else 0
            
            return full_text.strip(), all_words, avg_confidence
        
        except Exception as e:
            if DEBUG:
                traceback.print_exc()
            raise Exception(f"Failed to process PDF: {str(e)}")
    
    # Process the input file
    if is_pdf:
        text, words, confidence = process_pdf(input_path)
    else:
        text, words, confidence = process_image(input_path)
    
    # Prepare the result
    result = {
        "text": text,
        "confidence": confidence,
        "words": words,
        "pages": 1 if is_image else None  # For images, always 1 page
    }
    
    # If processing a PDF, count actual pages
    if is_pdf:
        try:
            doc = fitz.open(input_path)
            result["pages"] = len(doc)
        except:
            pass
    
    # Output the result
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        if DEBUG:
            print(f"Results written to {output_path}")
    else:
        # Print JSON to stdout for Node.js to capture
        print(json.dumps(result))
    
    sys.exit(0)  # Success
    
except Exception as e:
    error_message = str(e)
    error_traceback = traceback.format_exc()
    
    # Output the error
    error_result = {
        "error": error_message,
        "traceback": error_traceback
    }
    
    print(json.dumps(error_result), file=sys.stderr)
    sys.exit(1)  # Error
    
finally:
    # Always clean up the temp directory
    try:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
            if DEBUG:
                print(f"Cleaned up temp directory: {temp_dir}")
    except Exception as e:
        if DEBUG:
            print(f"Warning: Could not clean up temp directory {temp_dir}: {e}")