// test-google-vision.js
require('dotenv').config();

async function testGoogleVisionSetup() {
    console.log('=== Testing Google Vision Setup ===');
    
    // Check environment variables
    console.log('1. Environment Variables:');
    console.log('   OCR_IMPLEMENTATION:', process.env.OCR_IMPLEMENTATION);
    console.log('   GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
    console.log('   GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    // Check if credentials file exists
    const fs = require('fs');
    const credentialsExist = fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || '');
    console.log('   Credentials file exists:', credentialsExist);
    
    if (!credentialsExist) {
        console.error('❌ Credentials file not found! Check your GOOGLE_APPLICATION_CREDENTIALS path.');
        return;
    }
    
    // Test Google Vision client initialization
    console.log('\n2. Testing Google Vision Client:');
    try {
        const vision = require('@google-cloud/vision');
        const client = new vision.ImageAnnotatorClient({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        console.log('✅ Google Vision client initialized successfully');
        
        // Test basic API connectivity (this doesn't count against quota)
        console.log('\n3. Testing API Access:');
        // We'll just test client creation, not make actual API calls yet
        console.log('✅ Ready to make Vision API calls');
        
    } catch (error) {
        console.error('❌ Google Vision client initialization failed:', error.message);
        return;
    }
    
    // Test OCR parser loading
    console.log('\n4. Testing OCR Parser Loading:');
    try {
        const ocrParser = require('./src/parsers/index');
        console.log('   Current implementation:', ocrParser.getCurrentImplementation());
        console.log('   Has valid config:', ocrParser.hasValidConfig());
        console.log('   Is production mode:', ocrParser.isProductionMode());
        
        if (ocrParser.getCurrentImplementation() === 'GoogleVision' && ocrParser.hasValidConfig()) {
            console.log('✅ OCR Parser loaded successfully with Google Vision');
        } else {
            console.error('❌ OCR Parser configuration issue');
        }
        
    } catch (error) {
        console.error('❌ OCR Parser loading failed:', error.message);
        return;
    }
    
    console.log('\n=== Setup Test Complete ===');
    console.log('🎉 Google Vision is ready for local development!');
    console.log('💡 Next: Test with an actual document using your existing upload endpoint');
}

testGoogleVisionSetup().catch(console.error);