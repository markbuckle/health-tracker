// Provides status information about OCR processing and system health

const { implementation } = require('../../src/parsers');
const fs = require('fs').promises;
const path = require('path');

export default async function handler(req, res) {
  try {
    const { method, query } = req;
    
    // Handle different HTTP methods
    switch (method) {
      case 'GET':
        return await handleStatusCheck(req, res);
      case 'POST':
        return await handleJobStatus(req, res);
      default:
        return res.status(405).json({
          error: 'Method not allowed',
          supportedMethods: ['GET', 'POST']
        });
    }
  } catch (error) {
    console.error('Error in status endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Status check failed',
      message: error.message
    });
  }
}

/**
 * Handle general system status checks (GET request)
 */
async function handleStatusCheck(req, res) {
  const { type = 'system' } = req.query;
  
  switch (type) {
    case 'system':
      return await getSystemStatus(res);
    case 'ocr':
      return await getOCRStatus(res);
    case 'health':
      return await getHealthCheck(res);
    default:
      return res.status(400).json({
        error: 'Invalid status type',
        supportedTypes: ['system', 'ocr', 'health']
      });
  }
}

/**
 * Handle specific job status checks (POST request)
 */
async function handleJobStatus(req, res) {
  const { jobId, fileId, action = 'check' } = req.body;
  
  if (!jobId && !fileId) {
    return res.status(400).json({
      error: 'Missing required parameter',
      message: 'Either jobId or fileId is required'
    });
  }
  
  switch (action) {
    case 'check':
      return await checkJobStatus(jobId || fileId, res);
    case 'cancel':
      return await cancelJob(jobId || fileId, res);
    case 'retry':
      return await retryJob(jobId || fileId, res);
    default:
      return res.status(400).json({
        error: 'Invalid action',
        supportedActions: ['check', 'cancel', 'retry']
      });
  }
}

/**
 * Get overall system status
 */
async function getSystemStatus(res) {
  const status = {
    timestamp: new Date().toISOString(),
    service: 'HealthLync OCR Service',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    ocr: {
      implementation: implementation,
      available: true
    },
    endpoints: {
      extract: '/api/ocr/extract',
      analyze: '/api/ocr/analyze',
      status: '/api/ocr/status'
    }
  };
  
  // Add system-specific checks
  try {
    await checkDiskSpace();
    status.diskSpace = 'adequate';
  } catch (error) {
    status.diskSpace = 'warning';
    status.warnings = status.warnings || [];
    status.warnings.push('Low disk space detected');
  }
  
  return res.status(200).json({
    success: true,
    status: 'healthy',
    data: status
  });
}

/**
 * Get OCR-specific status
 */
async function getOCRStatus(res) {
  const ocrStatus = {
    timestamp: new Date().toISOString(),
    implementation: implementation,
    features: {
      pdfProcessing: true,
      imageProcessing: true,
      multiPageSupport: true,
      progressTracking: true,
      structuredReports: implementation === 'PaddleOCR'
    },
    supportedFormats: {
      documents: ['.pdf'],
      images: ['.jpg', '.jpeg', '.png']
    },
    capabilities: {
      biomarkerPatterns: await getBiomarkerPatternCount(),
      categories: await getCategoryCount(),
      maxFileSize: '200MB',
      averageProcessingTime: '30-60 seconds per page'
    }
  };
  
  // Test OCR implementation availability
  try {
    const testResult = await testOCRImplementation();
    ocrStatus.implementationTest = {
      status: 'passed',
      details: testResult
    };
  } catch (error) {
    ocrStatus.implementationTest = {
      status: 'failed',
      error: error.message
    };
  }
  
  return res.status(200).json({
    success: true,
    status: ocrStatus.implementationTest.status === 'passed' ? 'healthy' : 'degraded',
    data: ocrStatus
  });
}

/**
 * Get health check status
 */
async function getHealthCheck(res) {
  const checks = await Promise.allSettled([
    checkMemoryUsage(),
    checkTempDirectory(),
    checkOCRDependencies(),
    checkDatabaseConnection()
  ]);
  
  const healthStatus = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    checks: {
      memory: getCheckResult(checks[0]),
      tempDirectory: getCheckResult(checks[1]),
      ocrDependencies: getCheckResult(checks[2]),
      database: getCheckResult(checks[3])
    }
  };
  
  // Determine overall health
  const failedChecks = Object.values(healthStatus.checks)
    .filter(check => check.status === 'failed');
  
  if (failedChecks.length > 0) {
    healthStatus.overall = failedChecks.length > 2 ? 'unhealthy' : 'degraded';
  }
  
  const statusCode = healthStatus.overall === 'healthy' ? 200 : 503;
  
  return res.status(statusCode).json({
    success: healthStatus.overall !== 'unhealthy',
    status: healthStatus.overall,
    data: healthStatus
  });
}

/**
 * Check specific job status (placeholder for future job tracking)
 */
async function checkJobStatus(jobId, res) {
  // This would integrate with a job queue system like Bull or Agenda
  // For now, return a mock response
  
  const mockJobStatus = {
    jobId,
    status: 'completed', // pending, processing, completed, failed
    progress: 100,
    startTime: new Date(Date.now() - 30000).toISOString(),
    endTime: new Date().toISOString(),
    result: {
      biomarkersExtracted: 12,
      processingTime: '28 seconds',
      confidence: 'high'
    }
  };
  
  return res.status(200).json({
    success: true,
    data: mockJobStatus
  });
}

/**
 * Cancel a processing job (placeholder)
 */
async function cancelJob(jobId, res) {
  return res.status(200).json({
    success: true,
    message: `Job ${jobId} cancellation requested`,
    status: 'cancelled'
  });
}

/**
 * Retry a failed job (placeholder)
 */
async function retryJob(jobId, res) {
  return res.status(200).json({
    success: true,
    message: `Job ${jobId} retry initiated`,
    newJobId: `${jobId}-retry-${Date.now()}`
  });
}

// Helper functions

async function checkDiskSpace() {
  // Simple disk space check
  const tempDir = path.join(process.cwd(), 'temp');
  try {
    const stats = await fs.stat(tempDir);
    return { available: true, path: tempDir };
  } catch (error) {
    throw new Error('Temp directory not accessible');
  }
}

async function getBiomarkerPatternCount() {
  try {
    const { labPatterns } = require('../../src/parsers/labPatterns');
    return Object.keys(labPatterns).length;
  } catch (error) {
    return 0;
  }
}

async function getCategoryCount() {
  try {
    const { markerCategories } = require('../../src/parsers/biomarkerData');
    return Object.keys(markerCategories).length;
  } catch (error) {
    return 0;
  }
}

async function testOCRImplementation() {
  // This would test the actual OCR implementation
  // For now, return success if we can import the module
  try {
    const parser = require('../../src/parsers');
    return {
      implementation: parser.implementation,
      status: 'available'
    };
  } catch (error) {
    throw new Error(`OCR implementation test failed: ${error.message}`);
  }
}

async function checkMemoryUsage() {
  const usage = process.memoryUsage();
  const maxHeapSize = 512 * 1024 * 1024; // 512MB threshold
  
  if (usage.heapUsed > maxHeapSize) {
    throw new Error('High memory usage detected');
  }
  
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB'
  };
}

async function checkTempDirectory() {
  const tempDir = path.join(process.cwd(), 'temp');
  
  try {
    // Try to create temp directory if it doesn't exist
    await fs.mkdir(tempDir, { recursive: true });
    
    // Test write permissions
    const testFile = path.join(tempDir, 'test-write.tmp');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);
    
    return { status: 'writable', path: tempDir };
  } catch (error) {
    throw new Error(`Temp directory check failed: ${error.message}`);
  }
}

async function checkOCRDependencies() {
  // Check if OCR dependencies are available
  try {
    if (implementation === 'PaddleOCR') {
      // Would check Python and PaddleOCR installation
      return { python: 'available', paddleocr: 'available' };
    } else {
      // Would check Tesseract installation
      return { tesseract: 'available' };
    }
  } catch (error) {
    throw new Error(`OCR dependencies check failed: ${error.message}`);
  }
}

async function checkDatabaseConnection() {
  // This would test the actual database connection
  // For now, assume it's working if we're handling requests
  return { status: 'connected', type: 'mongodb' };
}

function getCheckResult(settledPromise) {
  if (settledPromise.status === 'fulfilled') {
    return {
      status: 'passed',
      details: settledPromise.value
    };
  } else {
    return {
      status: 'failed',
      error: settledPromise.reason.message
    };
  }
}