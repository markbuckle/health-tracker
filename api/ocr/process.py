from http.server import BaseHTTPRequestHandler
import json
import tempfile
import os
import base64
from paddleocr import PaddleOCR

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Read the request
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            
            # Parse JSON request
            request_data = json.loads(post_data.decode('utf-8'))
            file_data = base64.b64decode(request_data['file'])
            
            # Initialize PaddleOCR
            ocr = PaddleOCR(use_angle_cls=True, lang='en')
            
            # Save file temporarily
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
                tmp_file.write(file_data)
                tmp_file_path = tmp_file.name
            
            try:
                # Run OCR
                result = ocr.ocr(tmp_file_path, cls=True)
                
                # Extract text
                text = ""
                for page_result in result:
                    if page_result:
                        for line in page_result:
                            if len(line) >= 2:
                                text += line[1][0] + "\n"
                
                # Return response
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                response = {
                    "success": True,
                    "text": text
                }
                self.wfile.write(json.dumps(response).encode())
                
            finally:
                os.unlink(tmp_file_path)
                
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            error_response = {
                "success": False,
                "error": str(e)
            }
            self.wfile.write(json.dumps(error_response).encode())