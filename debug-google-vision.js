// debug-google-vision.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');

async function debugGoogleVision() {
    console.log('=== Debugging Google Vision OCR ===');
    
    // Test file path - you can change this to any file you want to test
    const testFile = 'C:\\Users\\Marks-Desktop\\Coding\\health-tracker-v2\\public\\uploads\\1755795203625-44214744.pdf';
    
    // Alternative: test with a simple text file if you have one
    // const testFile = './test-image.png';
    
    console.log('1. File Check:');
    console.log('   File exists:', fs.existsSync(testFile));
    if (fs.existsSync(testFile)) {
        const stats = fs.statSync(testFile);
        console.log('   File size:', stats.size, 'bytes');
        console.log('   File modified:', stats.mtime);
    }
    
    console.log('\n2. Testing Google Vision API with different methods:');
    try {
        const vision = require('@google-cloud/vision');
        const client = new vision.ImageAnnotatorClient({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        
        console.log('   Client initialized successfully');
        
        // Method 1: Test document text detection
        console.log('   \n   Method 1: Document Text Detection');
        try {
            const [result] = await client.documentTextDetection(testFile);
            console.log('   API call completed');
            
            if (result.error) {
                console.log('   ❌ Document detection error:', result.error.message);
            } else if (result.fullTextAnnotation) {
                console.log('   ✅ Document detection success');
                console.log('   Text length:', result.fullTextAnnotation.text?.length || 0);
            } else {
                console.log('   ❌ No fullTextAnnotation found');
            }
        } catch (docError) {
            console.log('   ❌ Document detection failed:', docError.message);
        }
        
        // Method 2: Test reading PDF as buffer and processing as image
        console.log('   \n   Method 2: PDF as Image Buffer');
        try {
            const fs = require('fs');
            const buffer = fs.readFileSync(testFile);
            console.log('   Read buffer size:', buffer.length, 'bytes');
            
            const [bufferResult] = await client.textDetection({
                image: { content: buffer }
            });
            
            if (bufferResult.error) {
                console.log('   ❌ Buffer method error:', bufferResult.error.message);
            } else if (bufferResult.textAnnotations && bufferResult.textAnnotations.length > 0) {
                console.log('   ✅ Buffer method success');
                console.log('   Text length:', bufferResult.textAnnotations[0].description?.length || 0);
                console.log('   First 200 chars:', bufferResult.textAnnotations[0].description?.substring(0, 200) || 'No text');
            } else {
                console.log('   ❌ No text annotations found with buffer method');
            }
        } catch (bufferError) {
            console.log('   ❌ Buffer method failed:', bufferError.message);
        }
        
    } catch (error) {
        console.error('❌ Google Vision API setup failed:', error.message);
    }
    
    console.log('\n3. Testing with different file types:');
    // Let's also test if there are any images in your uploads
    const uploadsDir = 'C:\\Users\\Marks-Desktop\\Coding\\health-tracker-v2\\public\\uploads';
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        console.log('   Files in uploads:', files.slice(0, 5)); // Show first 5 files
        
        // Find any JPG/PNG files to test
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
        if (imageFiles.length > 0) {
            const imageFile = path.join(uploadsDir, imageFiles[0]);
            console.log(`   Testing image file: ${imageFiles[0]}`);
            
            try {
                const vision = require('@google-cloud/vision');
                const client = new vision.ImageAnnotatorClient({
                    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
                    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
                });
                
                const [imageResult] = await client.textDetection(imageFile);
                console.log('   Image OCR result:', {
                    hasAnnotations: !!(imageResult.textAnnotations && imageResult.textAnnotations.length > 0),
                    textLength: imageResult.textAnnotations?.[0]?.description?.length || 0
                });
                
            } catch (imageError) {
                console.error('   Image OCR failed:', imageError.message);
            }
        }
    }
}

debugGoogleVision().catch(console.error);