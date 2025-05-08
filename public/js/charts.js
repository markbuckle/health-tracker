// Enhanced biomarker trend charts function

function isExactMatch(value, tickValues, epsilon = 0.00001) {
    return tickValues.some(tick => Math.abs(tick - value) < epsilon);
}

// Helper to checks if any reference range value is effectively the same as any auto-generated y-axis value, with a tiny margin of error to handle floating point precision issues
function isValueInArray(value, array, epsilon = 0.00001) {
    return array.some(item => Math.abs(item - value) < epsilon);
}

// Improved helper function to find lab values regardless of data structure
function findLabValue(file, name) {
    // Skip if file has no lab values
    if (!file.labValues) return null;
    
    // Get the biomarker data and its alternate names from window.__INITIAL_DATA__
    const biomarkerInfo = window.__INITIAL_DATA__?.biomarkerInfo?.[name];
    const alternateNames = biomarkerInfo?.alternateNames || [];
    
    // Create an array of all possible names (original plus alternates)
    const possibleNames = [name, ...alternateNames];
    
    // Try each possible name
    for (const possibleName of possibleNames) {
        let value = null;

        // Check for various data structures
        if (file.labValues instanceof Map) {
            // If labValues is a Map
            value = file.labValues.get(possibleName);
        } else if (typeof file.labValues.get === 'function') {
            // If labValues has a get method but isn't a standard Map
            value = file.labValues.get(possibleName);
        } else if (file.labValues.entries && typeof file.labValues.entries === 'function') {
            // If labValues is map-like with entries
            for (const [key, val] of file.labValues.entries()) {
                if (key.toLowerCase() === possibleName.toLowerCase()) {
                    value = val;
                    break;
                }
            }
        } else {
            // If labValues is a plain object
            value = file.labValues[possibleName];
            
            // Try case-insensitive lookup if direct lookup fails
            if (!value) {
                const lowerCaseName = possibleName.toLowerCase();
                for (const key in file.labValues) {
                    if (key.toLowerCase() === lowerCaseName) {
                        value = file.labValues[key];
                        break;
                    }
                }
            }
        }

        // Return the value if found
        if (value) {
            return {
                value: parseFloat(value.value),
                unit: value.unit,
                referenceRange: value.referenceRange?.replace(/\s+/g, '')  // Remove spaces
            };
        }
    }
    
    // Log when a biomarker isn't found
    console.debug(`Could not find lab value for biomarker: ${name} in file:`, file.filename || 'unknown file');
    
    return null;
}

// Function for creating biomarker trend charts
function createBiomarkerChart(biomarkerElement, biomarkerName) {
    if (!biomarkerElement) {
        console.warn(`Element for biomarker ${biomarkerName} not found`);
        return;
    }
    
    console.log(`Creating chart for biomarker: ${biomarkerName} in element:`, biomarkerElement.id);
    
    const files = window.__INITIAL_DATA__?.files || [];
    if (files.length === 0) {
        console.warn('No files found in __INITIAL_DATA__');
        return;
    }
    
    // Transform and sort the data
    const chartData = files
        .filter(file => {
            const value = findLabValue(file, biomarkerName);
            return value !== null;
        })
        .map(file => {
            const labValue = findLabValue(file, biomarkerName);
            return {
                date: new Date(file.testDate),
                value: parseFloat(labValue.value),
                unit: labValue.unit,
                referenceRange: labValue.referenceRange,
                filename: file.originalName || file.filename
            };
        })
        .sort((a, b) => a.date - b.date);

    if (chartData.length === 0) {
        console.warn(`No data points found for biomarker: ${biomarkerName}`);
        return;
    }
    
    const dates = chartData.map(d => d.date);
    const values = chartData.map(d => d.value);
    const unit = chartData[0]?.unit || '';

    // Get reference ranges from the first data point
    const referenceRange = chartData[0]?.referenceRange || '';
    let minRef, maxRef;
    
    // Try to parse the reference range
    if (referenceRange && referenceRange.includes('-')) {
        [minRef, maxRef] = referenceRange.split('-').map(Number);
    } else {
        // Fallback: use min/max values as references if no proper range exists
        const padding = 0.1; // 10% padding
        minRef = Math.min(...values) * (1 - padding);
        maxRef = Math.max(...values) * (1 + padding);
    }

    // Ensure we have valid numbers
    if (isNaN(minRef) || isNaN(maxRef)) {
        const padding = 0.1;
        minRef = Math.min(...values) * (1 - padding);
        maxRef = Math.max(...values) * (1 + padding);
    }
    
    // Calculate y-axis range with padding
    const yMin = Math.min(minRef * 0.9, Math.min(...values) * 0.9);
    const yMax = Math.max(maxRef * 1.1, Math.max(...values) * 1.1);

    // overlap detection code
    // const yAxisValues = [];
    // for (let tick = yMin; tick <= yMax; tick += (yMax - yMin) / 10) {
    // yAxisValues.push(parseFloat(tick.toFixed(1)));
    // }

    // const minRefTooClose = isValueInArray(minRef, yAxisValues);
    // const maxRefTooClose = isValueInArray(maxRef, yAxisValues);

    // Calculate reasonable y-axis tick values based on the range
    // const range = yMax - yMin;
    // const tickInterval = calculateTickInterval(range);
    // const firstTick = Math.floor(yMin / tickInterval) * tickInterval;
    // const yAxisTicks = [];

    // for (let tick = firstTick; tick <= yMax; tick += tickInterval) {
    //     yAxisTicks.push(tick);
    // }

    // // Check if reference range values exactly match any standard y-axis ticks
    // const minRefTooClose = yAxisTicks.some(tick => Math.abs(tick - minRef) < 0.0001);
    // const maxRefTooClose = yAxisTicks.some(tick => Math.abs(tick - maxRef) < 0.0001);

    // Calculate reasonable y-axis tick values based on the range
    // const range = yMax - yMin;
    // const tickInterval = calculateTickInterval(range);
    // const firstTick = Math.floor(yMin / tickInterval) * tickInterval;
    // const yAxisTicks = [];
    
    // for (let tick = firstTick; tick <= yMax; tick += tickInterval) {
    //     yAxisTicks.push(tick);
    // }
    
    // // Check if reference range values are too close to or exactly match standard y-axis ticks
    // const minRefTooClose = yAxisTicks.some(tick => Math.abs(tick - minRef) < tickInterval * 0.2 || Math.abs(tick - minRef) < 0.0001);
    // const maxRefTooClose = yAxisTicks.some(tick => Math.abs(tick - maxRef) < tickInterval * 0.2 || Math.abs(tick - maxRef) < 0.0001);
    
    // Create pink background for reference range zones
    const rangeShapes = [
        // Lower out-of-range area (pink background)
        {
            type: 'rect',
            xref: 'paper',
            yref: 'y',
            x0: 0,
            y0: yMin,
            x1: 1,
            y1: minRef,
            fillcolor: 'rgba(255, 200, 200, 0.3)',
            line: { width: 0 }
        },
        // Upper out-of-range area (pink background)
        {
            type: 'rect',
            xref: 'paper',
            yref: 'y',
            x0: 0,
            y0: maxRef,
            x1: 1,
            y1: yMax,
            fillcolor: 'rgba(255, 200, 200, 0.3)',
            line: { width: 0 }
        }
    ];

    // Create trace for data points
    const trace = {
        x: dates,
        y: values,
        type: 'scatter',
        mode: 'lines+markers',
        line: {
            color: '#1f77b4',
            width: 2
        },
        marker: {
            size: 8,
            color: '#1f77b4',
            line: {
                color: 'white',
                width: 1
            }
        },
        hovertemplate: '%{x|%b %d, %Y}<br>%{y:.1f} ' + unit + '<extra></extra>',
        hoverlabel: {
            bgcolor: '#2c8cdc',
            bordercolor: '#2c8cdc',
            font: { color: 'white', size: 12 },
            align: 'left'
        }
    };

    // Create annotations array for reference range labels
    const annotations = [];

    // Calculate the automatic y-axis ticks that Plotly will generate
    const yAxisTicks = [];
    const tickStep = calculateTickInterval(yMax - yMin);
    for (let tick = Math.floor(yMin / tickStep) * tickStep; tick <= yMax; tick += tickStep) {
    yAxisTicks.push(parseFloat(tick.toFixed(6)));
    }

    console.log('Y-axis ticks:', yAxisTicks);
    console.log('Reference ranges:', minRef, maxRef);

    // Only add reference annotations if they don't exactly match an axis tick
    if (!isExactMatch(minRef, yAxisTicks)) {
    annotations.push({
        x: -0.0455,
        xref: 'paper',
        y: minRef,
        yref: 'y',
        text: minRef.toFixed(1),
        showarrow: false,
        font: {
        family: 'Arial, sans-serif',
        size: 10.5,
        color: '#777',
        weight: 'bold'
        },
        align: 'right'
    });
    }

    if (!isExactMatch(maxRef, yAxisTicks)) {
    annotations.push({
        x: -0.05,
        xref: 'paper',
        y: maxRef,
        yref: 'y',
        text: maxRef.toFixed(1),
        showarrow: false,
        font: {
        family: 'Arial, sans-serif',
        size: 10.5,
        color: '#777',
        weight: 'bold'
        },
        align: 'right'
    });
    }

    // Add unit label annotation
    annotations.push({
    x: -0.08,
    y: 1.14, 
    xref: 'paper',
    yref: 'paper',
    text: unit,
    showarrow: false,
    font: {
        family: 'Arial, sans-serif',
        size: 14,
        color: '#666'
    },
    align: 'left'
    });

    // Layout with adjusted reference range markers
    const layout = {
        title: {
            text: biomarkerName,
            font: {
                family: 'Arial, sans-serif',
                size: 18,
                color: '#333'
            },
            x: 0.01,
            xanchor: 'left'
        },
        height: 350,
        autosize: true,
        margin: { l: 50, r: 30, t: 80, b: 60 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        shapes: rangeShapes,
        showlegend: false,
        hoverdistance: 100,
        hovermode: 'x unified',
        spikedistance: -1,
        xaxis: {
            type: 'date',
            showgrid: false,
            zeroline: false,
            tickformat: '%b %Y',
            tickfont: {
                family: 'Arial, sans-serif',
                size: 12,
                color: '#666'
            },
            range: [
                // Add padding before and after
                new Date(Math.min(...dates) - 30 * 24 * 60 * 60 * 1000),
                new Date(Math.max(...dates) + 30 * 24 * 60 * 60 * 1000)
            ],
            showspikes: true,
            spikethickness: 1,
            spikedash: 'dot',
            spikecolor: '#999',
            spikemode: 'across'
        },
        yaxis: {
            showgrid: true,
            gridcolor: '#e5e5e5',
            zeroline: false,
            fixedrange: true,
            range: [yMin, yMax],
            tickformat: '.1f',
            tickfont: {
                family: 'Arial, sans-serif',
                size: 12,
                color: '#666'
            },
            title: null
        },
        annotations: annotations
    };

    // Add reference range lines
    layout.shapes.push(
        // Min reference line
        {
            type: 'line',
            xref: 'paper',
            yref: 'y',
            x0: 0,
            y0: minRef,
            x1: 1,
            y1: minRef,
            line: {
                color: '#ddd',
                width: 1,
                dash: 'dash'
            }
        },
        // Max reference line
        {
            type: 'line',
            xref: 'paper',
            yref: 'y',
            x0: 0,
            y0: maxRef,
            x1: 1,
            y1: maxRef,
            line: {
                color: '#ddd',
                width: 1,
                dash: 'dash'
            }
        }
    );

    const config = {
        displayModeBar: false,
        responsive: true,
        scrollZoom: false,
        staticPlot: false
    };

    try {
        Plotly.newPlot(biomarkerElement.id, [trace], layout, config)
            .then(() => {
                console.log(`Successfully plotted chart for ${biomarkerName}`);
                
                // Add event listeners to hide any x-axis annotation at the bottom
                const plotArea = document.getElementById(biomarkerElement.id);
                
                // Create a mutation observer to watch for hover elements
                const observer = new MutationObserver((mutations) => {
                    // Check for any annotations that appear
                    const annotations = document.querySelectorAll(`#${biomarkerElement.id} .annotation`);
                    const hoverLabels = document.querySelectorAll(`#${biomarkerElement.id} .hovertext`);
                    
                    // Hide any x-axis annotations at the bottom
                    annotations.forEach(ann => {
                        const rect = ann.getBoundingClientRect();
                        const plotRect = plotArea.getBoundingClientRect();
                        if (rect.bottom > plotRect.bottom - 60) {
                            ann.style.display = 'none';
                        }
                    });
                    
                    // Ensure hover label stays visible
                    hoverLabels.forEach(label => {
                        label.style.backgroundColor = '#2c8cdc';
                        label.style.color = 'white';
                        label.style.border = '1px solid #2c8cdc';
                    });
                });
                
                // Start observing
                observer.observe(plotArea, {
                    childList: true,
                    subtree: true
                });
            })
            .catch(error => {
                console.error(`Error plotting chart for ${biomarkerName}:`, error);
            });
    } catch (error) {
        console.error(`Exception creating chart for ${biomarkerName}:`, error);
    }
}

// Helper function to calculate nice tick intervals
function calculateTickInterval(range) {
    // Find a nice interval that gives us about 5-7 ticks
    const targetNumTicks = 5;
    const roughInterval = range / targetNumTicks;
    
    // Find the magnitude of the rough interval
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
    
    // Find the most appropriate multiplier
    const normalized = roughInterval / magnitude;
    
    let multiplier;
    if (normalized < 1.5) {
        multiplier = 1;
    } else if (normalized < 3) {
        multiplier = 2;
    } else if (normalized < 7) {
        multiplier = 5;
    } else {
        multiplier = 10;
    }
    
    return magnitude * multiplier;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 365) {
        return `over a year ago`;
    } else if (diffDays > 30) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
    } else if (diffDays > 7) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    } else if (diffDays > 1) {
        return `${diffDays} days ago`;
    } else if (diffDays === 1) {
        return 'yesterday';
    } else {
        return 'today';
    }
}

// Helper to check if an element is in a visible tab
function isElementInVisibleTab(element) {
    if (!element) return false;
    
    const tabPane = element.closest('.w-tab-pane');
    if (!tabPane) return true; // Not in a tab pane, assume visible
    
    return tabPane.classList.contains('w--tab-active');
}

// Debug function to dump biomarker data
function logBiomarkerData() {
    const files = window.__INITIAL_DATA__?.files || [];
    const biomarkers = window.__INITIAL_DATA__?.biomarkers || [];
    
    console.log(`Found ${files.length} files and ${biomarkers.length} biomarkers`);
    
    if (files.length === 0 || biomarkers.length === 0) {
        console.warn('Missing files or biomarkers in __INITIAL_DATA__');
        console.log('__INITIAL_DATA__:', window.__INITIAL_DATA__);
        return;
    }
    
    // Log biomarker availability for each file
    const biomarkerAvailability = {};
    
    biomarkers.forEach(biomarker => {
        biomarkerAvailability[biomarker] = {
            count: 0,
            files: []
        };
        
        files.forEach(file => {
            const value = findLabValue(file, biomarker);
            if (value) {
                biomarkerAvailability[biomarker].count++;
                biomarkerAvailability[biomarker].files.push({
                    filename: file.originalName || file.filename,
                    value: value.value,
                    unit: value.unit
                });
            }
        });
    });
    
    console.log('Biomarker availability:', biomarkerAvailability);
    
    // Log which biomarkers have chart elements
    const biomarkerElements = {};
    
    biomarkers.forEach(biomarker => {
        const standardizedName = biomarker.toLowerCase()
            .replace(/[()]/g, '')
            .replace(/\s+/g, '');
            
        const elementIds = [
            `biomarker-trend-${standardizedName}`,
            `biomarker-trend-${standardizedName}-freq`,
            `biomarker-trend-${standardizedName}-all`
        ];
        
        const found = elementIds.filter(id => document.getElementById(id) !== null);
        
        biomarkerElements[biomarker] = {
            found: found.length > 0,
            elements: found
        };
    });
    
    console.log('Biomarker chart elements:', biomarkerElements);
}

// Full chart initialization function
function initializeBiomarkerCharts() {
    console.log('Starting biomarker chart initialization');
    
    // Debug first
    logBiomarkerData();
    
    const biomarkers = window.__INITIAL_DATA__?.biomarkers || [];
    if (biomarkers.length === 0) {
        console.warn('No biomarkers found in __INITIAL_DATA__');
        return;
    }
    
    // Try to find chart elements with various naming patterns
    biomarkers.forEach(biomarker => {
        // Create standardized name for DOM ID
        const standardizedName = biomarker.toLowerCase()
            .replace(/[\s()]/g, '')
            .replace(/[-+]/g, '');  // Also remove hyphens and plus signs
            
        // Try several ID patterns that might exist
        const patterns = [
            `biomarker-trend-${standardizedName}`,
            `biomarker-trend-${standardizedName}-freq`,
            `biomarker-trend-${standardizedName}-all`,
            // Try additional variations (remove special characters)
            `biomarker-trend-${biomarker.toLowerCase().replace(/[^a-z0-9]/g, '')}`
        ];
        
        // Keep track if we found any elements for this biomarker
        let elementFound = false;
        
        patterns.forEach(pattern => {
            const element = document.getElementById(pattern);
            if (element) {
                console.log(`Found chart element for ${biomarker} with ID: ${pattern}`);
                createBiomarkerChart(element, biomarker);
                elementFound = true;
            }
        });
        
        // If we didn't find any elements with standard patterns, try a more aggressive search
        if (!elementFound) {
            // Search for any element starting with "biomarker-trend-" that might contain our biomarker name
            const allChartElements = document.querySelectorAll('[id^="biomarker-trend-"]');
            for (const element of allChartElements) {
                const elementId = element.id.toLowerCase();
                
                // See if the element ID contains the biomarker name or its simplified form
                if (elementId.includes(standardizedName) || 
                    elementId.includes(biomarker.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
                    console.log(`Found chart element for ${biomarker} with partial match ID: ${element.id}`);
                    createBiomarkerChart(element, biomarker);
                    elementFound = true;
                    break;
                }
            }
        }
        
        if (!elementFound) {
            console.warn(`No chart element found for biomarker: ${biomarker}`);
        }
    });
}

// Ensure chart reinitialization when tabs change
function setupTabChangeHandlers() {
    // Add event listeners to all tab links
    document.querySelectorAll('.w-tab-link').forEach(tab => {
        tab.addEventListener('click', function() {
            // Wait for tab change animation to finish
            setTimeout(() => {
                console.log('Tab changed, reinitializing charts...');
                initializeBiomarkerCharts();
            }, 250);
        });
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing biomarker charts...');
    
    // Check if __INITIAL_DATA__ is available
    if (!window.__INITIAL_DATA__) {
        console.error('__INITIAL_DATA__ not found. Charts cannot be initialized.');
        return;
    }
    
    // Initialize charts
    initializeBiomarkerCharts();
    
    // Set up tab change handlers
    setupTabChangeHandlers();
    
    // Also reinitialize charts after a delay to catch any rendering issues
    setTimeout(initializeBiomarkerCharts, 1000);
});

// Re-initialize on window resize for responsive behavior
window.addEventListener('resize', function() {
    // Use a debounce to prevent too many updates
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(function() {
        console.log('Window resized, reinitializing charts...');
        initializeBiomarkerCharts();
    }, 500);
});