import sys
import os

# COMPREHENSIVE PyMuPDF compatibility patch for PaddleOCR 2.6.1.3
try:
    import pymupdf as fitz
except ImportError:
    import fitz

def apply_pymupdf_compatibility_patches():
    """Apply comprehensive compatibility patches for PyMuPDF API changes"""
    
    # Patch Document class
    Document = fitz.Document
    if not hasattr(Document, 'pageCount'):
        def get_pagecount(self):
            return getattr(self, 'page_count', len(self))
        Document.pageCount = property(get_pagecount)
        print("Added Document.pageCount compatibility", file=sys.stderr)
    
    # Patch Page class
    Page = fitz.Page
    if not hasattr(Page, 'getPixmap'):
        def getPixmap(self, matrix=None, alpha=False, **kwargs):
            # Map old getPixmap to new get_pixmap
            if matrix is not None:
                return self.get_pixmap(matrix=matrix, alpha=alpha, **kwargs)
            else:
                return self.get_pixmap(alpha=alpha, **kwargs)
        Page.getPixmap = getPixmap
        print("Added Page.getPixmap compatibility", file=sys.stderr)
    
    # Additional common compatibility patches
    if not hasattr(Page, 'getText'):
        def getText(self, output="text", flags=None):
            return self.get_text(output=output, flags=flags)
        Page.getText = getText
        print("Added Page.getText compatibility", file=sys.stderr)
    
    # Patch Pixmap class if needed
    try:
        Pixmap = fitz.Pixmap
        if not hasattr(Pixmap, 'getPNGData'):
            def getPNGData(self):
                return self.tobytes("png")
            Pixmap.getPNGData = getPNGData
            print("Added Pixmap.getPNGData compatibility", file=sys.stderr)
    except:
        pass

# Apply all patches BEFORE importing PaddleOCR
apply_pymupdf_compatibility_patches()

# Now import PaddleOCR after patches are applied
from paddleocr import PaddleOCR

# Check if file path was provided
if len(sys.argv) < 2:
    print("Usage: python paddle_ocr.py <file_path>")
    sys.exit(1)

file_path = sys.argv[1]

# Initialize PaddleOCR (2.x syntax)
ocr = PaddleOCR(use_angle_cls=True, lang='en')

# Count total pages
def count_pdf_pages(file_path):
    try:
        if file_path.lower().endswith('.pdf'):
            doc = fitz.open(file_path)
            page_count = getattr(doc, 'page_count', len(doc))
            doc.close()
            return page_count
        else:
            return 1
    except Exception as e:
        print(f"Page counting failed: {e}", file=sys.stderr)
        return 1

# Get total pages
total_pages = count_pdf_pages(file_path)
print(f"TOTAL_PAGES:{total_pages}", file=sys.stderr)

try:
    # Process the file
    result = ocr.ocr(file_path, cls=True)
    
    # Print recognized text with page information
    if result:
        for page_idx, page_result in enumerate(result):
            current_page = page_idx + 1
            print(f"CURRENT_PAGE:{current_page}", file=sys.stderr)
            
            if page_result:
                for line in page_result:
                    if len(line) >= 2 and len(line[1]) >= 1:
                        print(line[1][0])
            else:
                print(f"No text found on page {current_page}", file=sys.stderr)
    else:
        print("No OCR results returned", file=sys.stderr)

except Exception as e:
    print(f"OCR processing failed: {e}", file=sys.stderr)
    import traceback
    traceback.print_exc(file=sys.stderr)
    sys.exit(1)