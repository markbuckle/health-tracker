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
    
    // For now, let's hardcode your user ID for testing
    // TODO: Add proper authentication later
    const hardcodedUserId = "68401daf362c3d1af8918e62"; // Your user ID from the logs
    
    const { registerCollection } = await import('../../src/mongodb.js');
    const user = await registerCollection.findById(hardcodedUserId);
    console.log('🔍 User found:', !!user);
    console.log('🔍 User data preview:', user ? 'User exists' : 'No user');
    
    if (!user) {
      console.log('❌ User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('🔍 Raw family history:', user?.profile?.familyHistory);
    console.log('🔍 Raw lifestyle:', user?.profile?.lifestyle);
    console.log('🔍 Raw monitoring:', user?.profile?.monitoring);
    
    // Extract family history with full details
    let familyHistoryDetails = [];
    if (user.profile?.familyHistory && Array.isArray(user.profile.familyHistory)) {
      familyHistoryDetails = user.profile.familyHistory
        .filter(item => item && item.familyCondition)
        .map(item => ({
          condition: item.familyCondition,
          relatives: item.relatives || 'Not specified',
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
          status: item.status || 'Not specified',
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
    
    console.log('🔍 Processed family history:', familyHistoryDetails);
    console.log('🔍 Processed lifestyle:', lifestyleDetails);
    console.log('🔍 Processed medications:', medicationDetails);
    console.log('🔍 User context prepared (Production)');
    
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