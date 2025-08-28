// api/rag/context.js
export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    console.log('🔍 USER CONTEXT ENDPOINT CALLED (Production)');
    
    // Extract userId from request body
    const { userId } = req.body;
    
    if (!userId) {
      console.log('❌ No userId provided in request');
      return res.status(400).json({ 
        error: 'Missing userId', 
        message: 'userId is required in request body'
      });
    }
    
    // Import and connect to MongoDB with proper error handling
    let connectToMongoDB, registerCollection, isConnected, mongoose;
    try {
      const mongoModule = await import('../../src/mongodb.js');
      connectToMongoDB = mongoModule.connectToMongoDB;
      registerCollection = mongoModule.registerCollection;
      isConnected = mongoModule.isConnected;
      mongoose = mongoModule.default || mongoModule.mongoose;
      console.log('📊 MongoDB module imported successfully');
    } catch (importError) {
      console.error('❌ MongoDB import failed:', importError);
      return res.status(500).json({ 
        error: 'Database connection failed', 
        details: 'Import error',
        message: 'Unable to load database module'
      });
    }

    // Ensure MongoDB connection
    try {
      if (!isConnected()) {
        console.log('🔄 Establishing MongoDB connection...');
        await Promise.race([
          connectToMongoDB(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), 8000)
          )
        ]);
      }
      console.log('✅ MongoDB connection verified');
    } catch (connectionError) {
      console.error('❌ MongoDB connection failed:', connectionError.message);
      return res.status(503).json({ 
        error: 'Database connection failed', 
        details: connectionError.message,
        message: 'Unable to connect to database. Please try again.'
      });
    }

    // Query user with timeout and proper error handling
    let user;
    try {
      console.log(`🔍 Querying user: ${userId}`);
      
      if (mongoose && mongoose.connection && mongoose.connection.db) {
        console.log('🔍 Available collections:', await mongoose.connection.db.listCollections().toArray());
        console.log('🔍 User count in collection:', await registerCollection.countDocuments());
      }
      
      user = await Promise.race([
        registerCollection.findById(userId).lean(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 5000)
        )
      ]);
      
      console.log('🔍 User query completed:', !!user);
    } catch (queryError) {
      console.error('❌ User query failed:', queryError.message);
      return res.status(500).json({ 
        error: 'Database query failed', 
        details: queryError.message,
        message: 'Unable to retrieve user data'
      });
    }
    
    console.log('🔍 User found:', !!user);
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Extract family history with full details
    let familyHistoryDetails = [];
    if (user.profile?.familyHistory && Array.isArray(user.profile.familyHistory)) {
      familyHistoryDetails = user.profile.familyHistory
        .filter(item => item && item.familyCondition)
        .map(item => ({
          condition: item.familyCondition,
          relatives: Array.isArray(item.relatives) ? item.relatives.join(', ') : item.relatives || 'Not specified',
          notes: item.addNotes || 'No notes'
        }));
    }
    
    // Extract lifestyle with full details
    let lifestyleDetails = [];
    if (user.profile?.lifestyle && Array.isArray(user.profile.lifestyle)) {
      lifestyleDetails = user.profile.lifestyle
        .filter(item => item && item.habitType)
        .map(item => ({
          habitType: item.habitType,
          status: Array.isArray(item.status) ? item.status.join(', ') : item.status || 'Not specified',
          notes: item.lifestyleNotes || 'No notes'
        }));
    }
    
    // Extract medications with full details
    let medicationDetails = [];
    if (user.profile?.medsandsups && Array.isArray(user.profile.medsandsups)) {
      medicationDetails = user.profile.medsandsups
        .filter(item => item && (item.medicine || item.supplement || item.name))
        .map(item => ({
          name: item.medicine || item.supplement || item.name,
          type: item.medSupType || (item.medicine ? 'Medicine' : 'Supplement'),
          dosage: item.dosage || 'Not specified',
          frequency: item.frequency || 'Not specified',
          notes: item.medsAndSupsNotes || item.notes || 'No notes'
        }));
    }
    
    // Extract monitoring with full details
    let monitoringDetails = [];
    if (user.profile?.monitoring && Array.isArray(user.profile.monitoring)) {
      monitoringDetails = user.profile.monitoring
        .filter(item => item)
        .map(item => ({
          weight: item.weight || 'Not specified',
          bloodPressure: item.bloodPressure || 'Not specified',
          restingHeartRate: item.restingHeartRate || 'Not specified',
          sleep: item.sleep || 'Not specified',
          notes: item.monitoringNotes || 'No notes'
        }));
    }
    
    // Helper function to extract recent lab values
    const extractRecentLabValues = (files) => {
      try {
        if (!files || files.length === 0) return {};
        
        const recentFiles = files
          .filter(f => f.labValues && Object.keys(f.labValues).length > 0)
          .sort((a, b) => new Date(b.testDate) - new Date(a.testDate))
          .slice(0, 3);
          
        const labSummary = {};
        recentFiles.forEach(file => {
          try {
            const entries = file.labValues instanceof Map ? 
              Array.from(file.labValues.entries()) : 
              Object.entries(file.labValues);
              
            entries.forEach(([key, value]) => {
              labSummary[key] = {
                value: value.value,
                unit: value.unit,
                referenceRange: value.referenceRange,
                date: file.testDate
              };
            });
          } catch (fileError) {
            console.error('Error processing file:', fileError);
          }
        });
        
        return labSummary;
      } catch (error) {
        console.error('Error extracting lab values:', error);
        return {};
      }
    };
    
    const userContext = {
      userId: user._id,
      profile: {
        age: user.profile?.age,
        sex: user.profile?.sex,
        bloodType: user.profile?.bloodType,
        familyHistoryDetails: familyHistoryDetails,
        lifestyleDetails: lifestyleDetails,
        medicationDetails: medicationDetails,
        monitoringDetails: monitoringDetails
      },
      recentLabValues: extractRecentLabValues(user.files || []),
      healthConcerns: user.profile?.familyHistory?.length > 0 ? ['family_history_risk'] : []
    };
    
    console.log('✅ User context prepared successfully (Production)');
    
    res.status(200).json({ userContext });

  } catch (error) {
    console.error('❌ Error in user context endpoint (Production):', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to prepare user context', 
      details: error.message 
    });
  }
}