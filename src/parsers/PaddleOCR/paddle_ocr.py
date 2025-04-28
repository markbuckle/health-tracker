import sys
import os
from paddleocr import PaddleOCR

# Check if file path was provided
if len(sys.argv) < 2:
    print("Usage: python paddle_ocr.py <file_path>")
    sys.exit(1)

file_path = sys.argv[1]

# Initialize PaddleOCR
ocr = PaddleOCR(use_angle_cls=True, lang='en')

# Process the file
result = ocr.ocr(file_path, cls=True)

# Print recognized text
for idx in range(len(result)):
    for line in result[idx]:
        if len(line) >= 2:
            print(line[1][0])  # Print just the text