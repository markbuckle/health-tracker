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

// Make it available globally for the browser
if (typeof window !== 'undefined') {
    window.calculateRangePositions = calculateRangePositions;
}

// Make it available for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calculateRangePositions };
}