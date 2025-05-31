// Analyzes extracted OCR data and provides health insights

const { biomarkerData, getRecommendableBiomarkers } = require('../../src/parsers/biomarkerData');

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    const { labValues, userBiomarkers = [], analysisType = 'basic' } = req.body;

    // Validate input
    if (!labValues || typeof labValues !== 'object') {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'labValues object is required'
      });
    }

    console.log(`Analyzing ${Object.keys(labValues).length} lab values`);

    // Perform analysis based on type
    let analysis;
    switch (analysisType) {
      case 'comprehensive':
        analysis = await performComprehensiveAnalysis(labValues, userBiomarkers);
        break;
      case 'recommendations':
        analysis = await generateRecommendations(labValues, userBiomarkers);
        break;
      case 'basic':
      default:
        analysis = await performBasicAnalysis(labValues);
        break;
    }

    res.status(200).json({
      success: true,
      analysis,
      processedAt: new Date().toISOString(),
      biomarkerCount: Object.keys(labValues).length
    });

  } catch (error) {
    console.error('Error in OCR analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Analysis failed',
      message: error.message
    });
  }
}

/**
 * Perform basic analysis of lab values
 */
async function performBasicAnalysis(labValues) {
  const analysis = {
    summary: {
      totalBiomarkers: Object.keys(labValues).length,
      categorizedBiomarkers: {},
      inRange: 0,
      outOfRange: 0,
      noRange: 0
    },
    biomarkers: {},
    insights: []
  };

  // Analyze each biomarker
  for (const [biomarkerName, data] of Object.entries(labValues)) {
    const biomarkerInfo = biomarkerData[biomarkerName];
    const category = biomarkerInfo?.category || 'unknown';
    
    // Count by category
    if (!analysis.summary.categorizedBiomarkers[category]) {
      analysis.summary.categorizedBiomarkers[category] = 0;
    }
    analysis.summary.categorizedBiomarkers[category]++;

    // Analyze range status
    const rangeStatus = analyzeRangeStatus(data);
    analysis.summary[rangeStatus]++;

    // Store biomarker analysis
    analysis.biomarkers[biomarkerName] = {
      value: data.value,
      unit: data.unit,
      category,
      rangeStatus,
      confidence: data.confidence || 0.8,
      description: biomarkerInfo?.description || 'No description available'
    };
  }

  // Generate basic insights
  analysis.insights = generateBasicInsights(analysis.summary);

  return analysis;
}

/**
 * Perform comprehensive analysis with trends and correlations
 */
async function performComprehensiveAnalysis(labValues, userBiomarkers = []) {
  const basicAnalysis = await performBasicAnalysis(labValues);
  
  // Add comprehensive features
  basicAnalysis.trends = analyzeTrends(userBiomarkers);
  basicAnalysis.correlations = findCorrelations(labValues);
  basicAnalysis.riskFactors = identifyRiskFactors(labValues);
  basicAnalysis.recommendations = await generateRecommendations(labValues, userBiomarkers);

  return basicAnalysis;
}

/**
 * Generate recommendations for missing or concerning biomarkers
 */
async function generateRecommendations(labValues, userBiomarkers = []) {
  const recommendations = {
    missingBiomarkers: [],
    concerningValues: [],
    followUpTests: [],
    lifestyle: []
  };

  // Find missing important biomarkers
  const recommendableBiomarkers = getRecommendableBiomarkers();
  const testedBiomarkers = new Set(Object.keys(labValues).map(name => name.toLowerCase()));

  for (const [biomarkerName, biomarkerInfo] of Object.entries(recommendableBiomarkers)) {
    const recommendation = biomarkerInfo.recommendation;
    
    // Check if any alias of this biomarker has been tested
    const isPresent = recommendation.aliases.some(alias => 
      Array.from(testedBiomarkers).some(tested => 
        tested.includes(alias.toLowerCase()) || alias.toLowerCase().includes(tested)
      )
    );

    if (!isPresent) {
      recommendations.missingBiomarkers.push({
        name: biomarkerName,
        priority: recommendation.priority,
        category: recommendation.category,
        explanation: recommendation.explanation
      });
    }
  }

  // Identify concerning values
  for (const [biomarkerName, data] of Object.entries(labValues)) {
    const rangeStatus = analyzeRangeStatus(data);
    if (rangeStatus === 'outOfRange') {
      recommendations.concerningValues.push({
        name: biomarkerName,
        value: data.value,
        unit: data.unit,
        referenceRange: data.referenceRange,
        severity: calculateSeverity(data)
      });
    }
  }

  // Sort recommendations by priority
  recommendations.missingBiomarkers.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return recommendations;
}

/**
 * Analyze if a biomarker value is in range
 */
function analyzeRangeStatus(data) {
  if (!data.referenceRange) return 'noRange';
  
  const rangeParts = data.referenceRange.replace(/\s+/g, '').split('-');
  if (rangeParts.length !== 2) return 'noRange';
  
  const minValue = parseFloat(rangeParts[0]);
  const maxValue = parseFloat(rangeParts[1]);
  const biomarkerValue = parseFloat(data.value);
  
  if (isNaN(minValue) || isNaN(maxValue) || isNaN(biomarkerValue)) {
    return 'noRange';
  }
  
  return (biomarkerValue >= minValue && biomarkerValue <= maxValue) 
    ? 'inRange' 
    : 'outOfRange';
}

/**
 * Calculate severity of out-of-range values
 */
function calculateSeverity(data) {
  if (!data.referenceRange) return 'unknown';
  
  const rangeParts = data.referenceRange.replace(/\s+/g, '').split('-');
  if (rangeParts.length !== 2) return 'unknown';
  
  const minValue = parseFloat(rangeParts[0]);
  const maxValue = parseFloat(rangeParts[1]);
  const biomarkerValue = parseFloat(data.value);
  
  if (isNaN(minValue) || isNaN(maxValue) || isNaN(biomarkerValue)) {
    return 'unknown';
  }
  
  const range = maxValue - minValue;
  
  if (biomarkerValue < minValue) {
    const deviation = (minValue - biomarkerValue) / range;
    if (deviation > 0.5) return 'high';
    if (deviation > 0.2) return 'medium';
    return 'low';
  } else if (biomarkerValue > maxValue) {
    const deviation = (biomarkerValue - maxValue) / range;
    if (deviation > 0.5) return 'high';
    if (deviation > 0.2) return 'medium';
    return 'low';
  }
  
  return 'normal';
}

/**
 * Generate basic insights from analysis summary
 */
function generateBasicInsights(summary) {
  const insights = [];
  
  const totalWithRange = summary.inRange + summary.outOfRange;
  if (totalWithRange > 0) {
    const inRangePercentage = Math.round((summary.inRange / totalWithRange) * 100);
    insights.push({
      type: 'range_summary',
      message: `${inRangePercentage}% of your biomarkers with reference ranges are within normal limits`,
      severity: inRangePercentage >= 80 ? 'good' : inRangePercentage >= 60 ? 'moderate' : 'concerning'
    });
  }
  
  if (summary.outOfRange > 0) {
    insights.push({
      type: 'out_of_range',
      message: `${summary.outOfRange} biomarker(s) are outside normal ranges and may need attention`,
      severity: 'attention'
    });
  }
  
  // Category-specific insights
  const topCategory = Object.entries(summary.categorizedBiomarkers)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (topCategory) {
    insights.push({
      type: 'category_focus',
      message: `Most tested biomarkers are related to ${topCategory[0]} health (${topCategory[1]} tests)`,
      severity: 'info'
    });
  }
  
  return insights;
}

/**
 * Analyze trends (placeholder - would need historical data)
 */
function analyzeTrends(userBiomarkers) {
  // This would analyze historical biomarker data for trends
  // For now, return placeholder
  return {
    improving: [],
    declining: [],
    stable: []
  };
}

/**
 * Find correlations between biomarkers (simplified)
 */
function findCorrelations(labValues) {
  const correlations = [];
  
  // Example: Check for metabolic syndrome patterns
  const glucose = labValues['Fasting Blood Glucose']?.value;
  const triglycerides = labValues['Triglycerides']?.value;
  const hdl = labValues['HDL-C']?.value;
  
  if (glucose && triglycerides && hdl) {
    if (glucose > 5.6 && triglycerides > 1.7 && hdl < 1.0) {
      correlations.push({
        type: 'metabolic_pattern',
        biomarkers: ['Fasting Blood Glucose', 'Triglycerides', 'HDL-C'],
        message: 'Pattern suggests increased metabolic syndrome risk',
        severity: 'attention'
      });
    }
  }
  
  return correlations;
}

/**
 * Identify potential risk factors
 */
function identifyRiskFactors(labValues) {
  const riskFactors = [];
  
  // Cardiovascular risk factors
  const apoB = labValues['Apo-B']?.value;
  const lpa = labValues['Lp(a)']?.value;
  const hsCRP = labValues['hsCRP']?.value;
  
  if (apoB && apoB > 1.2) {
    riskFactors.push({
      type: 'cardiovascular',
      biomarker: 'Apo-B',
      message: 'Elevated ApoB increases cardiovascular risk',
      severity: 'high'
    });
  }
  
  if (lpa && lpa > 125) {
    riskFactors.push({
      type: 'cardiovascular',
      biomarker: 'Lp(a)',
      message: 'Elevated Lp(a) is a genetic cardiovascular risk factor',
      severity: 'high'
    });
  }
  
  return riskFactors;
}