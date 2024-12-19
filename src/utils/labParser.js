const fs = require('fs'); //  import the node.js file system (FS) module
const path = require('path');
const { createWorker } = require('tesseract.js'); // Import the Tesseract.js library's createWorker function
const pdf = require('pdf-parse'); // Import the pdf-parse library for extracting text from PDF files
const { PDFExtract } = require('pdf.js-extract'); // Import the PDFExtract class from the pdf.js-extract library (though it's not used in the code)
const pdfExtract = new PDFExtract();
const { createCanvas } = require('canvas');

let pdfjsLib;
(async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
    pdfjsLib = pdfjs.default;
    // Set workerSrc to a string path
    pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.js');
})();

// Define lab value patterns to extract specific lab values from text
const labPatterns = {
    // Current patterns enhanced
    'Vitamin D': /(?:Vitamin ?D|25-OH Vitamin D|25-Hydroxyvitamin D)[^0-9]*(\d+\.?\d*)\s*(ng\/mL|IU\/L|nmol\/L)/i,
    'Estrogen': /(?:Estrogen|Estradiol|E2)[^0-9]*(\d+\.?\d*)\s*(pg\/mL|pmol\/L)/i,
    'White Blood Count': /(?:White Blood (?:Cell )?Count|WBC)[^0-9]*(\d+\.?\d*)\s*(K\/uL|×10⁹\/L|10\^9\/L)/i,
    'Red Blood Count': /(?:Red Blood (?:Cell )?Count|RBC)[^0-9]*(\d+\.?\d*)\s*(M\/uL|×10¹²\/L|10\^12\/L)/i,
    'Hemoglobin': /(?:Hemoglobin|Hgb|Hb)[^0-9]*(\d+\.?\d*)\s*(g\/dL|g\/L)/i,
    'Platelets': /(?:Platelets?|PLT)[^0-9]*(\d+\.?\d*)\s*(K\/uL|×10⁹\/L|10\^9\/L)/i,
    'Hematocrit': /(?:Hematocrit|HCT)[^0-9]*(\d+\.?\d*)\s*(%|L\/L)/i,

    // current file
    'SHBG': /sex hormone binding globulin\s+(\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?-\d+(?:\.\d+)?)\s*(nmol\/L)/i,
    'Testosterone Bioavailable': /testosterone bioavailable\s+(\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?-\d+(?:\.\d+)?)\s*(nmol\/L)/i,
    'T4 FREE': /t4 free\s+(\d+(?:\.\d+)?)\s+(?:\d+(?:[\.,]\d+)?[-,]?\d+(?:[\.,]\d+)?)\s*(?:pmol\/L|pmol\/l|prolil?)/i,
    'FSH': /fsh\s+(\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?-\d+(?:\.\d+)?)\s*(?:IU\/L|[IU]\/L|iu\/l|ui)/i,
    'TSH': /tsh\s+(\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?-\d+(?:\.\d+)?)\s*(?:mIU\/L|miu\/l|miu)/i,

    // Others
    'T4': /(?:T4|Thyroxine)[^0-9]*(\d+\.?\d*)\s*(pmol\/L|μg\/dL)/i,
    'T3': /(?:T3|Triiodothyronine)[^0-9]*(\d+\.?\d*)\s*(pmol\/L|ng\/dL)/i,
    'T3 FREE': /(?:Free T3|T3 FREE|FT3)[^0-9]*(\d+\.?\d*)\s*(pmol\/L|pg\/mL)/i,
    'Testosterone': /(?:Testosterone|Total Testosterone|TEST)[^0-9]*(\d+\.?\d*)\s*(nmol\/L|ng\/dL)/i,
    'Cortisol': /(?:Cortisol|Serum Cortisol)[^0-9]*(\d+\.?\d*)\s*(nmol\/L|μg\/dL)/i,
    'Prolactin': /(?:Prolactin|PRL)[^0-9]*(\d+\.?\d*)\s*(ng\/mL|μg\/L)/i,
    'LH': /(?:LH|Luteinizing Hormone)[^0-9]*(\d+\.?\d*)\s*(IU\/L|mIU\/mL)/i
    // Add more patterns as needed
};

// Function to extract text from a PDF file and parse lab values
async function extractFromPDF(filePath) {
    try {
        while (!pdfjsLib) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        let results = {};
        const dataBuffer = fs.readFileSync(filePath);
        console.log('Reading PDF file:', filePath);

        try {
            const data = await pdf(dataBuffer);
            console.log('Extracted raw text:', data.text);
            if (data.text.trim()) {
                results = parseLabValues(data.text);
            }
        } catch (error) {
            console.log('Error with text extraction:', error);
        }

        // If no results or partial results, try OCR
        if (Object.keys(results).length === 0) {
            console.log('No results found with text extraction, trying OCR...');

            const loadingTask = pdfjsLib.getDocument({ data: dataBuffer });
            const pdfDocument = await loadingTask.promise;
            const numPages = pdfDocument.numPages;
            console.log(`PDF has ${numPages} pages`);

            let allText = '';
            
            // Process each page
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                console.log(`Processing page ${pageNum}`);
                const page = await pdfDocument.getPage(pageNum);

                const scale = 2.0;
                const viewport = page.getViewport({ scale });
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };

                await page.render(renderContext).promise;

                // Use Tesseract.js for OCR
                const worker = await createWorker();
                const { data: { text } } = await worker.recognize(canvas.toBuffer('image/png'));
                console.log(`OCR extracted text from page ${pageNum}:`, text);
                
                allText += text + '\n';
                await worker.terminate();
            }

            // Parse values from all pages combined
            const pageResults = parseLabValues(allText);
            results = { ...results, ...pageResults };
        }

        return results;
    } catch (error) {
        console.error('Error extracting from PDF:', error);
        throw error;
    }
}

// Function to extract text from an image file using Tesseract.js and parse lab values
async function extractFromImage(filePath) {
    const worker = await createWorker('eng'); // Create a Tesseract.js worker for OCR
    try {
        const { data: { text } } = await worker.recognize(filePath); // Use the worker to recognize text in the image file
        await worker.terminate(); // Terminate the worker after use
        return parseLabValues(text); // Parse and return the extracted lab values
    } catch (error) {
        console.error('Error extracting from image:', error);
        await worker.terminate(); // Ensure the worker is terminated even if an error occurs
        throw error;
    }
}

// Function to parse lab values from text using defined patterns
function parseLabValues(text) {
    const results = {}; // Initialize an empty object to store the parsed results
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');

    console.log('Normalized text for parsing:', normalizedText);
    
    // Loop through each defined lab pattern
    for (const [testName, pattern] of Object.entries(labPatterns)) { 
        // For debugging, log each pattern being tried
        console.log(`Trying pattern for ${testName}:`, pattern);

        const match = text.match(pattern); // Attempt to match the pattern in the text
        
        // If a match is found, extract and store the value, unit, and raw text
        if (match) {
            console.log(`Found match for ${testName}:`, match); // Add this to see matches
            results[testName] = {
                value: parseFloat(match[1]),
                unit: match[2],
                rawText: match[0],
                referenceRange: match[3] || null  // Add reference range if found
            };
        } else {
            console.log(`No match found for ${testName}`);
        }
    }
    
    // Return the parsed lab values
    return results;
}

// Export the functions for use in other modules
module.exports = {
    extractFromPDF,
    extractFromImage,
    parseLabValues
};