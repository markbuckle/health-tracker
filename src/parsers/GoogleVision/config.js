// src/parsers/GoogleVision/config.js
require('dotenv').config();

// Environment detection
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
const isProduction = process.env.NODE_ENV === 'production' || isVercel;

// Google Cloud Vision Configuration
const visionConfig = {
  // For local development, use service account key file
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  
  // For production (Vercel), use service account key from environment variable
  credentials: isProduction && process.env.GOOGLE_SERVICE_ACCOUNT_KEY 
    ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
    : undefined,
    
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
};

console.log(`Google Vision Config - Environment: ${isProduction ? 'Production' : 'Development'}`);
console.log(`Google Vision Config - Project ID: ${visionConfig.projectId}`);
console.log(`Google Vision Config - Has Credentials: ${!!(visionConfig.keyFilename || visionConfig.credentials)}`);

module.exports = {
  visionConfig,
  isProduction,
  isVercel
};