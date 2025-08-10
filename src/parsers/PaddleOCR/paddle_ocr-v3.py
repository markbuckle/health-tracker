import sys
import os

# Check if file path was provided
if len(sys.argv) < 2:
    print("Usage: python paddle_ocr.py <file_path>")
    sys.exit(1)

file_path = sys.argv[1]

try:
    # PaddleOCR 3.1.0 correct initialization
    from paddleocr import PaddleOCR
    
    # Initialize with minimal parameters for 3.1.0
    ocr = PaddleOCR(lang='en')
    
    print(f"TOTAL_PAGES:1", file=sys.stderr)
    print(f"CURRENT_PAGE:1", file=sys.stderr)

    # Use the predict method (3.x API)
    result = ocr.predict(file_path)
    
    # Process results according to 3.x format
    if hasattr(result, '__iter__'):
        for page_result in result:
            if hasattr(page_result, 'text_res') and page_result.text_res:
                # Extract text from the new 3.x result format
                for text_item in page_result.text_res:
                    print(text_item.get('text', ''))
            elif isinstance(page_result, list):
                # Fallback to old format handling
                for line in page_result:
                    if len(line) >= 2 and len(line[1]) >= 1:
                        print(line[1][0])
    else:
        print("No text detected", file=sys.stderr)

except Exception as e:
    print(f"OCR Error: {e}", file=sys.stderr)
    
    # Try alternative approach with explicit pipeline
    try:
        from paddleocr import PPOCRv5
        
        print("Trying PPOCRv5 pipeline...", file=sys.stderr)
        pipeline = PPOCRv5()
        result = pipeline.predict(file_path)
        
        if result:
            for page in result:
                if hasattr(page, 'text_res'):
                    for text_item in page.text_res:
                        print(text_item.get('text', ''))
        
    except Exception as e2:
        print(f"PPOCRv5 Error: {e2}", file=sys.stderr)
        sys.exit(1)