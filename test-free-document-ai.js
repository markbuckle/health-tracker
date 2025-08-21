// test-free-document-ai.js
require('dotenv').config();
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');

async function testFreeDocumentAI() {
    console.log('=== Testing FREE Document AI OCR ===');
    
    try {
        const client = new DocumentProcessorServiceClient({
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
        });
        
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const location = process.env.DOCUMENT_AI_LOCATION;
        const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
        
        console.log('Config check:');
        console.log('- Project ID:', projectId);
        console.log('- Location:', location);
        console.log('- Processor ID:', processorId);
        
        const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
        console.log('- Full processor name:', name);
        
        // Get processor info to verify it's the right type
        const [processor] = await client.getProcessor({ name });
        console.log('- Processor type:', processor.type);
        console.log('- Processor state:', processor.state);
        
        if (processor.type !== 'OCR_PROCESSOR') {
            console.warn('⚠️  WARNING: This is not an OCR_PROCESSOR!');
            console.warn('   Current type:', processor.type);
            console.warn('   This might be expensive!');
        } else {
            console.log('✅ Confirmed: Using FREE OCR_PROCESSOR');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testFreeDocumentAI();