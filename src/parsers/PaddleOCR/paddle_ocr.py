#!/usr/bin/env python3
"""
Debug version of PaddleOCR script to identify text extraction issues
"""

import sys
import os
import fitz  # PyMuPDF
import cv2
import numpy as np
from paddleocr import PaddleOCR
import tempfile
from PIL import Image, ImageEnhance
import logging

# Configure logging to stderr so it doesn't interfere with text output
logging.basicConfig(level=logging.WARNING, stream=sys.stderr)

def simple_preprocess(image):
    """
    Simplified preprocessing to avoid over-processing
    """
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # Simple threshold
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return binary

def process_pdf_page_simple(pdf_path, page_num, ocr):
    """
    Simplified page processing with debug output
    """
    try:
        # Open PDF and get page
        doc = fitz.open(pdf_path)
        page = doc[page_num]
        
        # Render page at moderate resolution
        zoom = 1.3  # Reduced from 2.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        
        # Convert to numpy array
        img_data = pix.tobytes("ppm")
        nparr = np.frombuffer(img_data, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Simple preprocessing
        processed_image = simple_preprocess(image)
        
        # Run OCR with basic parameters
        ocr_result = ocr.ocr(processed_image, cls=True, det=True, rec=True)
        
        print(f"DEBUG: Page {page_num + 1} OCR result type: {type(ocr_result)}", file=sys.stderr)
        print(f"DEBUG: Page {page_num + 1} OCR result length: {len(ocr_result) if ocr_result else 0}", file=sys.stderr)
        
        # Extract text with simple layout
        text_lines = []
        if ocr_result and ocr_result[0]:
            print(f"DEBUG: Page {page_num + 1} has {len(ocr_result[0])} detections", file=sys.stderr)
            
            for i, detection in enumerate(ocr_result[0]):
                bbox, (text, confidence) = detection
                
                # Debug output for first few detections
                if i < 5:
                    print(f"DEBUG: Detection {i}: '{text}' (confidence: {confidence:.2f})", file=sys.stderr)
                
                # Filter and collect text
                if confidence > 0.5 and len(text.strip()) > 1:
                    # Get bounding box coordinates
                    x1, y1 = bbox[0]
                    x2, y2 = bbox[2]
                    center_y = (y1 + y2) / 2
                    center_x = (x1 + x2) / 2
                    
                    text_lines.append({
                        'text': text.strip(),
                        'y': center_y,
                        'x': center_x,
                        'confidence': confidence
                    })
        
        doc.close()
        print(f"DEBUG: Page {page_num + 1} extracted {len(text_lines)} text elements", file=sys.stderr)
        return text_lines
        
    except Exception as e:
        print(f"ERROR processing page {page_num}: {e}", file=sys.stderr)
        return []

def simple_text_reconstruction(text_elements):
    """
    Simple text reconstruction that preserves readability
    """
    if not text_elements:
        return ""
    
    # Sort by y-coordinate (top to bottom) then x-coordinate (left to right)
    text_elements.sort(key=lambda x: (x['y'], x['x']))
    
    # Group into lines based on y-coordinate
    lines = []
    current_line = []
    current_y = None
    y_threshold = 20  # Pixels
    
    for element in text_elements:
        y = element['y']
        
        if current_y is None or abs(y - current_y) > y_threshold:
            # Start new line
            if current_line:
                # Sort current line by x-coordinate and join
                current_line.sort(key=lambda x: x['x'])
                line_text = ' '.join([elem['text'] for elem in current_line])
                lines.append(line_text)
            current_line = [element]
            current_y = y
        else:
            # Add to current line
            current_line.append(element)
    
    # Don't forget the last line
    if current_line:
        current_line.sort(key=lambda x: x['x'])
        line_text = ' '.join([elem['text'] for elem in current_line])
        lines.append(line_text)
    
    result = '\n'.join(lines)
    
    # Debug output
    print(f"DEBUG: Reconstructed {len(lines)} lines of text", file=sys.stderr)
    print(f"DEBUG: First 200 chars: {result[:200]}", file=sys.stderr)
    
    return result

def process_pdf_simple(pdf_path):
    """
    Simplified PDF processing with extensive debugging
    """
    try:
        # Initialize PaddleOCR with basic parameters
        print("DEBUG: Initializing PaddleOCR...", file=sys.stderr)
        ocr = PaddleOCR(
            use_angle_cls=False,     # Disable angle classification for simplicity
            lang='en',
            show_log=False,
            use_gpu=False,
            det_db_thresh=0.5,       # Higher threshold for cleaner detection
            det_db_box_thresh=0.6
        )
        print("DEBUG: PaddleOCR initialized successfully", file=sys.stderr)
        
        # Get page count
        doc = fitz.open(pdf_path)
        total_pages = len(doc)
        doc.close()
        
        print(f"TOTAL_PAGES:{total_pages}", file=sys.stderr)
        print(f"DEBUG: Processing {total_pages} pages", file=sys.stderr)
        
        all_text_elements = []
        
        for page_num in range(total_pages):
            print(f"CURRENT_PAGE:{page_num + 1}", file=sys.stderr)
            
            page_elements = process_pdf_page_simple(pdf_path, page_num, ocr)
            
            if page_elements:
                # Add page break for multi-page documents
                if page_num > 0:
                    all_text_elements.append({
                        'text': f'--- Page {page_num + 1} ---',
                        'y': page_num * 1000,  # Ensure pages are separated
                        'x': 0,
                        'confidence': 1.0
                    })
                
                # Offset y-coordinates for different pages
                for element in page_elements:
                    element['y'] += page_num * 1000
                
                all_text_elements.extend(page_elements)
        
        print(f"DEBUG: Total text elements collected: {len(all_text_elements)}", file=sys.stderr)
        
        # Reconstruct text
        if all_text_elements:
            result = simple_text_reconstruction(all_text_elements)
            print(f"DEBUG: Final text length: {len(result)} characters", file=sys.stderr)
            return result
        else:
            print("DEBUG: No text elements found", file=sys.stderr)
            return ""
        
    except Exception as e:
        print(f"ERROR in process_pdf_simple: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return ""

def main():
    """
    Main function with debug output
    """
    if len(sys.argv) != 2:
        print("Usage: python paddle_ocr.py <file_path>", file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    print(f"DEBUG: Processing file: {file_path}", file=sys.stderr)
    
    if not os.path.exists(file_path):
        print(f"ERROR: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)
    
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        print(f"DEBUG: File extension: {file_extension}", file=sys.stderr)
        
        if file_extension == '.pdf':
            extracted_text = process_pdf_simple(file_path)
        else:
            print(f"ERROR: Unsupported file type: {file_extension}", file=sys.stderr)
            sys.exit(1)
        
        # Output the extracted text
        print(extracted_text)
        
    except Exception as e:
        print(f"ERROR in main: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()