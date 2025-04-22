
import sys
import os
import json
import traceback

# Disable progress bar to avoid encoding issues
os.environ["EASYOCR_DISABLE_PROGRESS"] = "1"

try:
    # Try importing the required libraries
    import easyocr
    from PIL import Image
    
    # Function to handle PDFs
    def process_pdf(file_path):
        try:
            from pdf2image import convert_from_path
            # Convert PDF to images
            images = convert_from_path(file_path, dpi=300)
            all_text = ""
            
            # Process each page
            for i, img in enumerate(images):
                # Save temporarily
                img_path = os.path.join(os.path.dirname(file_path), f"temp_page_{i}.jpg")
                img.save(img_path)
                
                print(f"Processing page {i+1} of {len(images)}", file=sys.stderr)
                
                # Process with EasyOCR
                detection_result = reader.readtext(img_path)
                
                # Sort text by vertical position (top to bottom, left to right)
                detection_result.sort(key=lambda x: (x[0][0][1], x[0][0][0]))
                
                # Group text into lines based on vertical position
                lines = []
                current_line = []
                current_y = None
                
                for box, text, conf in detection_result:
                    y_pos = (box[0][1] + box[2][1]) / 2  # Average Y position
                    
                    if current_y is None:
                        current_y = y_pos
                        
                    # If this text is significantly below the current line, start a new line
                    if abs(y_pos - current_y) > 20:  # Adjust threshold as needed
                        if current_line:
                            lines.append(' '.join(current_line))
                            current_line = []
                        current_y = y_pos
                    
                    current_line.append(text)
                
                # Add the last line
                if current_line:
                    lines.append(' '.join(current_line))
                
                # Join lines with newlines
                page_text = '\n'.join(lines)
                all_text += f"\n--- PAGE {i+1} ---\n{page_text}\n"
                
                # Clean up
                try:
                    os.remove(img_path)
                except:
                    pass
                    
            return all_text
        except Exception as e:
            return f"Error processing PDF: {str(e)}\n{traceback.format_exc()}"
    
    # Initialize EasyOCR with silent download
    print("Initializing EasyOCR reader...", file=sys.stderr)
    reader = easyocr.Reader(['en'], verbose=False, download_enabled=True)
    
    # Get file path from command line argument
    file_path = sys.argv[1]
    print(f"Processing file: {file_path}", file=sys.stderr)
    
    # Determine file type and process accordingly
    if file_path.lower().endswith('.pdf'):
        text = process_pdf(file_path)
    else:
        # Process single image
        detection_result = reader.readtext(file_path)
        
        # Sort text by position
        detection_result.sort(key=lambda x: (x[0][0][1], x[0][0][0]))
        
        # Group text into lines
        lines = []
        current_line = []
        current_y = None
        
        for box, text, conf in detection_result:
            y_pos = (box[0][1] + box[2][1]) / 2
            
            if current_y is None:
                current_y = y_pos
                
            if abs(y_pos - current_y) > 20:
                if current_line:
                    lines.append(' '.join(current_line))
                    current_line = []
                current_y = y_pos
            
            current_line.append(text)
        
        if current_line:
            lines.append(' '.join(current_line))
        
        text = '\n'.join(lines)
    
    # Output the extracted text as JSON
    output = {
        "text": text,
        "confidence": 0.9  # Simple confidence value
    }
    
    print(json.dumps(output))
    
except Exception as e:
    # Handle any errors
    error_output = {
        "error": str(e),
        "traceback": traceback.format_exc()
    }
    print(json.dumps(error_output), file=sys.stderr)
    sys.exit(1)
        