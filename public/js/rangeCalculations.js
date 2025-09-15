// bar chart range calculations
function calculateRangePositions(min, max) {

    const svgWidth = 420;
    const chartStart = 7;
    const chartWidth = 405;

    if (min === null || min === undefined || max === null || max === undefined || isNaN(min) || isNaN(max)) {
        return null;
    }

    const range = max - min;
    
    const valueToX = (value, type = 'normal') => {
        if (typeof value !== 'number') value = parseFloat(value);
        if (isNaN(value)) {
            console.warn('Invalid value in valueToX:', value);
            return chartStart;
        }

        const effectiveMax = max;
        
        switch(type) {
            case 'zero':
                // Position for zero
                return chartStart;
            case 'marker':
                // Scale marker position relative to the normal range
                const markerPercentage = value / effectiveMax;
                return chartStart + (markerPercentage * chartWidth * 0.7);
            case 'max':
                // Position for range.max label (at end of normal section)
                return chartStart + (chartWidth * 0.7);
            default:
                // For other values
                const percentage = value / effectiveMax;
                return chartStart + (percentage * chartWidth * 0.7);
        }
        return result;
    };

    const scaling = {
        low: {
            x: chartStart,
            width: valueToX(min) - chartStart
        },
        normal: {
            x: valueToX(min),
            width: valueToX(max, 'max') - valueToX(min)
        },
        high: {
            x: valueToX(max, 'max'),
            width: chartWidth - valueToX(max, 'max')
        },
        getMarkerPosition: function(value) {
            return valueToX(value, 'marker');
        },
        getLabelPosition: function(value, position = 'normal') {
            switch(position) {
                case 'zero':
                    return valueToX(0, 'zero');
                case 'max':
                    return valueToX(max, 'max');
                default:
                    return valueToX(value);
            }
        }
    };
    return scaling;
}

// NEW: Adaptive range calculation function
function calculateAdaptiveRangePositions(min, max, value) {
    const svgWidth = 420;
    const chartStart = 20;
    const chartWidth = 380;

    if (min === null || min === undefined || max === null || max === undefined || isNaN(min) || isNaN(max)) {
        return null;
    }

    // Convert value to number if it's not already
    if (typeof value !== 'number') {
        value = parseFloat(value);
    }
    
    // If value is still NaN, fall back to traditional scaling
    if (isNaN(value)) {
        console.warn('Invalid biomarker value provided to adaptive scaling, falling back to traditional scaling');
        return calculateRangePositions(min, max);
    }

    // Determine if we should use adaptive scaling
    const normalRangeSize = max - min;
    const distanceFromZero = min;
    const shouldUseAdaptiveScaling = distanceFromZero > normalRangeSize * 2; // e.g., Sodium case

    let scaleMin, scaleMax;

    if (shouldUseAdaptiveScaling) {
        // Strategy 1: Focus on the normal range with reasonable padding
        const padding = normalRangeSize * 0.5; // 50% padding on each side
        scaleMin = Math.max(0, min - padding);
        scaleMax = max + padding;
        
        // Ensure the actual value is visible with some margin
        if (value < scaleMin) {
            scaleMin = Math.max(0, value - normalRangeSize * 0.2);
        }
        if (value > scaleMax) {
            scaleMax = value + normalRangeSize * 0.2;
        }
    } else {
        // Strategy 2: Traditional zero-based scaling for ranges close to zero
        scaleMin = 0;
        scaleMax = Math.max(max * 1.2, value * 1.1); // Ensure value fits with margin
    }

    const totalRange = scaleMax - scaleMin;
    
    const valueToX = (inputValue, type = 'normal') => {
        if (typeof inputValue !== 'number') inputValue = parseFloat(inputValue);
        if (isNaN(inputValue)) {
            console.warn('Invalid value in adaptive valueToX:', inputValue);
            return chartStart;
        }

        // Calculate relative position within our adaptive scale
        const relativePosition = (inputValue - scaleMin) / totalRange;
        return chartStart + (relativePosition * chartWidth);
    };

    // Calculate section positions based on adaptive scale
    const scaling = {
        low: {
            x: chartStart,
            width: Math.max(0, valueToX(min) - chartStart) // Ensure non-negative width
        },
        normal: {
            x: valueToX(min),
            width: Math.max(0, valueToX(max) - valueToX(min)) // Ensure non-negative width
        },
        high: {
            x: valueToX(max),
            width: Math.max(0, chartStart + chartWidth - valueToX(max)) // Ensure non-negative width
        },
        getMarkerPosition: function(inputValue) {
            return valueToX(inputValue);
        },
        getLabelPosition: function(inputValue, position = 'normal') {
            return valueToX(inputValue);
        },
        // Additional properties for the template
        scaleMin: scaleMin,
        scaleMax: scaleMax,
        isAdaptiveScale: shouldUseAdaptiveScaling
    };

    return scaling;
}

// Range-centered scaling alternative (you can use this instead if you prefer)
function calculateRangeCenteredScaling(min, max, value) {
    const svgWidth = 420;
    const chartStart = 7;
    const chartWidth = 405;

    if (typeof value !== 'number') {
        value = parseFloat(value);
    }
    
    if (isNaN(value)) {
        return calculateRangePositions(min, max);
    }

    const normalRangeSize = max - min;
    const normalRangeCenter = (min + max) / 2;
    
    // Create a scale centered on the normal range
    const scaleRadius = Math.max(
        normalRangeSize * 1.5, // Minimum scale is 3x the normal range
        Math.abs(value - normalRangeCenter) * 1.2 // Or enough to show the value with margin
    );
    
    const scaleMin = Math.max(0, normalRangeCenter - scaleRadius);
    const scaleMax = normalRangeCenter + scaleRadius;
    
    const totalRange = scaleMax - scaleMin;
    
    const valueToX = (inputValue) => {
        if (typeof inputValue !== 'number') inputValue = parseFloat(inputValue);
        if (isNaN(inputValue)) return chartStart;
        
        const relativePosition = (inputValue - scaleMin) / totalRange;
        return chartStart + (relativePosition * chartWidth);
    };

    return {
        low: {
            x: chartStart,
            width: Math.max(0, valueToX(min) - chartStart)
        },
        normal: {
            x: valueToX(min),
            width: Math.max(0, valueToX(max) - valueToX(min))
        },
        high: {
            x: valueToX(max),
            width: Math.max(0, chartStart + chartWidth - valueToX(max))
        },
        getMarkerPosition: function(inputValue) {
            return valueToX(inputValue);
        },
        getLabelPosition: function(inputValue) {
            return valueToX(inputValue);
        },
        scaleMin: scaleMin,
        scaleMax: scaleMax,
        isRangeCentered: true
    };
}

// Make functions available globally for the browser
if (typeof window !== 'undefined') {
    window.calculateRangePositions = calculateRangePositions;
    window.calculateAdaptiveRangePositions = calculateAdaptiveRangePositions;
    window.calculateRangeCenteredScaling = calculateRangeCenteredScaling;
}

// Make functions available for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        calculateRangePositions,
        calculateAdaptiveRangePositions,
        calculateRangeCenteredScaling
    };
}