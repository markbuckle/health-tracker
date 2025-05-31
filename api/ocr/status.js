// Provides status information about OCR processing and system health

// /api/ocr/status.js
export default async function handler(req, res) {
  try {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}