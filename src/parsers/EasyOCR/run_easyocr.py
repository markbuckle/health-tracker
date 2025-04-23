#!/usr/bin/env python3
"""
Minimal EasyOCR script for extracting text from PDFs and images
"""

import sys
import os
import re
import tempfile
import traceback
from typing import List

# Check if we have enough arguments
if len(sys.argv) < 2:
    print("Usage: python run_easyocr.py <path_to_file>")
    sys.exit(1)

file_path = sys.argv[1]
file_ext = os.path.splitext(file_path)[1].lower()

try:
    # Import required libraries
    import easyocr
    import cv2
    import numpy as np
    from pdf2image import convert_from_path
    
    # Initialize EasyOCR reader
    reader = easyocr.Reader(['en'], gpu=False)  # Set gpu=True if you have a GPU
    
    # Process file based on type
    if file_ext == '.pdf':
        # Convert PDF to images
        all_text = []
        # Use higher DPI for better quality
        images = convert_from_path(file_path, dpi=300)
        
        for i, image in enumerate(images):
            print(f"Processing page {i+1}", file=sys.stderr)
            # Convert PIL Image to OpenCV format
            open_cv_image = np.array(image)
            # RGB to BGR for OpenCV
            open_cv_image = open_cv_image[:, :, ::-1].copy()
            
            # Try to detect and enhance text areas
            gray = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2GRAY)
            # Apply adaptive thresholding to enhance text visibility
            enhanced = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Extract text from both the original and enhanced images
            # and combine the results for better coverage
            result_orig = reader.readtext(open_cv_image)
            result_enhanced = reader.readtext(enhanced)
            
            # Combine results from both versions
            page_text = ' '.join([entry[1] for entry in result_orig])
            page_text += ' ' + ' '.join([entry[1] for entry in result_enhanced])
            
            # Look specifically for date patterns
            date_pattern = r'(?:Date|Collection|Collected)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})'
            date_matches = re.findall(date_pattern, page_text, re.IGNORECASE)
            if date_matches:
                print(f"Found date: {date_matches[0]}", file=sys.stderr)
                
            all_text.append(page_text)
        
        # Combine text from all pages
        full_text = '\n\n'.join(all_text)
    else:
        # Process image file directly
        image = cv2.imread(file_path)
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        # Try with both original and enhanced
        result_orig = reader.readtext(image)
        
        # Apply adaptive thresholding
        enhanced = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        result_enhanced = reader.readtext(enhanced)
        
        # Combine results
        full_text = ' '.join([entry[1] for entry in result_orig])
        full_text += ' ' + ' '.join([entry[1] for entry in result_enhanced])
    
    # Print extracted text (will be captured by Node.js)
    print(full_text)
    
except Exception as e:
    print(f"Error processing file: {str(e)}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)