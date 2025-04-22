"""
Standalone EasyOCR script for testing HealthLync OCR 

Usage:
python run_easyocr.py <path_to_file>

This script will attempt to extract text from a PDF or image file
using EasyOCR and print the results.
"""

import sys
import os
import traceback

# Check if file path was provided
if len(sys.argv) < 2:
    print("Please provide a file path")
    sys.exit(1)

file_path = sys.argv[1]
if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    sys.exit(1)

print(f"Processing file: {file_path}")
file_ext = os.path.splitext(file_path)[1].lower()

# Check if it's an image or PDF
is_image = file_ext in ['.jpg', '.jpeg', '.png', '.tiff', '.bmp']
is_pdf = file_ext == '.pdf'

if not (is_image or is_pdf):
    print(f"Unsupported file format: {file_ext}")
    sys.exit(1)

# Import necessary libraries
try:
    import easyocr
    print("EasyOCR imported successfully")
except ImportError:
    print("ERROR: EasyOCR not found. Please install with: pip install easyocr")
    sys.exit(1)

# Process image file
if is_image:
    try:
        # Initialize reader
        print("Initializing EasyOCR reader...")
        reader = easyocr.Reader(['en'])
        
        # Run OCR
        print(f"Processing image file: {file_path}")
        results = reader.readtext(file_path, detail=0)
        
        # Print results
        text = '\n'.join(results)
        print(f"Extracted {len(text)} characters")
        print("---RESULT START---")
        print(text)
        print("---RESULT END---")
        
        # Save to output file
        output_file = os.path.join(os.path.dirname(file_path), 'ocr_output.txt')
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Results saved to {output_file}")
        
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        traceback.print_exc()
        sys.exit(1)

# Process PDF file
else:
    # First try PyMuPDF
    success = False
    
    # Try with PyMuPDF
    try:
        import fitz  # PyMuPDF
        print("PyMuPDF imported successfully")
        
        # Initialize reader
        print("Initializing EasyOCR reader...")
        reader = easyocr.Reader(['en'])
        
        # Open PDF
        pdf_document = fitz.open(file_path)
        print(f"PDF opened successfully: {pdf_document.page_count} pages")
        
        all_text = []
        
        # Process each page
        for page_num in range(pdf_document.page_count):
            print(f"Processing page {page_num+1}/{pdf_document.page_count}")
            page = pdf_document[page_num]
            
            # Get a pixmap (image) of the page
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scaling for better OCR
            
            # Save to a temporary image file
            temp_img_path = os.path.join(os.path.dirname(file_path), f'temp_page_{page_num}.png')
            pix.save(temp_img_path)
            
            # OCR the page image
            page_results = reader.readtext(temp_img_path, detail=0)
            page_text = '\n'.join(page_results)
            all_text.append(page_text)
            
            # Clean up temporary image
            os.remove(temp_img_path)
            
        # Combine all page texts
        full_text = '\n\n'.join(all_text)
        
        # Print results
        print(f"Extracted {len(full_text)} characters with PyMuPDF")
        print("---RESULT START---")
        print(full_text[:500] + "..." if len(full_text) > 500 else full_text)
        print("---RESULT END---")
        
        # Save to output file
        output_file = os.path.join(os.path.dirname(file_path), 'ocr_output.txt')
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(full_text)
        print(f"Results saved to {output_file}")
        
        success = True
        
    except ImportError:
        print("PyMuPDF not found, trying pdf2image...")
    except Exception as e:
        print(f"Error with PyMuPDF: {str(e)}")
        traceback.print_exc()
    
    # If PyMuPDF failed, try with pdf2image
    if not success:
        try:
            from pdf2image import convert_from_path
            print("pdf2image imported successfully")
            
            # Initialize reader
            print("Initializing EasyOCR reader...")
            reader = easyocr.Reader(['en'])
            
            # Convert PDF to images
            print(f"Converting PDF to images: {file_path}")
            images = convert_from_path(file_path, dpi=200)
            print(f"Converted {len(images)} pages to images")
            
            all_text = []
            
            # Process each page image
            for i, image in enumerate(images):
                print(f"Processing page {i+1}/{len(images)}")
                
                # Save to a temporary file
                temp_img_path = os.path.join(os.path.dirname(file_path), f'temp_page_{i}.png')
                image.save(temp_img_path, 'PNG')
                
                # OCR the page image
                page_results = reader.readtext(temp_img_path, detail=0)
                page_text = '\n'.join(page_results)
                all_text.append(page_text)
                
                # Clean up temporary image
                os.remove(temp_img_path)
            
            # Combine all page texts
            full_text = '\n\n'.join(all_text)
            
            # Print results
            print(f"Extracted {len(full_text)} characters with pdf2image")
            print("---RESULT START---")
            print(full_text[:500] + "..." if len(full_text) > 500 else full_text)
            print("---RESULT END---")
            
            # Save to output file
            output_file = os.path.join(os.path.dirname(file_path), 'ocr_output.txt')
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(full_text)
            print(f"Results saved to {output_file}")
            
        except ImportError:
            print("ERROR: pdf2image not found. Please install with: pip install pdf2image")
            print("Also make sure Poppler is installed and in your PATH.")
            sys.exit(1)
        except Exception as e:
            print(f"Error with pdf2image: {str(e)}")
            traceback.print_exc()
            sys.exit(1)