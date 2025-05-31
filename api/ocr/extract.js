//  API endpoint handler for OCR extraction

const { extractFromPDF } = require('../../src/parsers');

export default async function handler(req, res) {
  try {
    // Handle file upload, validation, etc.
    const result = await extractFromPDF(filePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}