import sys
import os
from paddleocr import PaddleOCR
import fitz  # PyMuPDF for PDF page counting

# Check if file path was provided
if len(sys.argv) < 2:
    print("Usage: python paddle_ocr.py <file_path>")
    sys.exit(1)

file_path = sys.argv[1]

# Initialize PaddleOCR
ocr = PaddleOCR(use_angle_cls=True, lang='en')

# Count total pages if it's a PDF
def count_pdf_pages(file_path):
    try:
        if file_path.lower().endswith('.pdf'):
            doc = fitz.open(file_path)
            page_count = len(doc)
            doc.close()
            return page_count
        else:
            return 1  # Images are considered as 1 page
    except:
        return 1  # Default to 1 if we can't determine
    
# Get total pages
total_pages = count_pdf_pages(file_path)
print(f"TOTAL_PAGES:{total_pages}", file=sys.stderr)

# Process the file
result = ocr.ocr(file_path, cls=True)

# Print recognized text with page information
for page_idx, page_result in enumerate(result):
    current_page = page_idx + 1
    print(f"CURRENT_PAGE:{current_page}", file=sys.stderr)
    
    if page_result:
        for line in page_result:
            if len(line) >= 2:
                print(line[1][0])  # Print just the text