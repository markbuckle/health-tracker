// Enhanced biomarker trend charts function - FIXED VERSION

/// Helper/Utility functions (loaded first)

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

// Helper to checks if any reference range value is effectively the same as any auto-generated y-axis value
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
    
    // Log when a biomarker isn't found (at debug level to reduce noise)
    // console.debug(`Could not find lab value for biomarker: ${name} in file:`, file.filename || 'unknown file');
    
    return null;
}

// Helper function to check if an element is visible (accounts for all parent containers)
function isElementVisible(element) {
    if (!element) return false;
    
    // Check if this element has dimensions
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    
    // Check if this element or any parent is hidden via style
    let currentElement = element;
    while (currentElement) {
        const style = window.getComputedStyle(currentElement);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }
        
        // Check for tab pane that's not active
        if (currentElement.classList.contains('w-tab-pane') && 
            !currentElement.classList.contains('w--tab-active')) {
            return false;
        }
        
        // Move up to parent
        currentElement = currentElement.parentElement;
    }
    
    return true;
}

/// CSS and DOM preparation (run before any chart functionality)

// Add CSS styles for temporary classes
function addTemporaryStyling() {
    // Avoid adding styles multiple times
    if (document.getElementById('chart-temp-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'chart-temp-styles';
    style.textContent = `
        /* Hidden render containers - completely invisible */
        .temp-expand-for-render {
            height: auto !important;
            opacity: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            z-index: -1 !important;
            pointer-events: none !important;
            transform: translateZ(0) !important; /* Force GPU rendering */
            visibility: hidden !important;
        }
        
        .temp-open-for-render {
            display: block !important;
            opacity: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            z-index: -1 !important;
            pointer-events: none !important;
            transform: translateZ(0) !important; /* Force GPU rendering */
            visibility: hidden !important;
        }
        
        /* Add better sizing for chart containers */
        [id^="biomarker-trend-"] {
            min-height: 300px !important;
            height: 350px !important;
            width: 100% !important;
            display: block !important;
        }
    `;
    document.head.appendChild(style);
}

/// Core chart functions

// Add this function to your charts.js file:
function forcePlotlyRender() {
    document.querySelectorAll('[id^="biomarker-trend-"]').forEach(chart => {
        try {
            if (chart && chart.id) {
                // Force the chart to use 100% width of its container
                chart.style.width = '100%';
                
                // Tell Plotly to resize itself
                Plotly.Plots.resize(chart.id);
            }
        } catch (e) {
            // Ignore errors
        }
    });
}

// Core chart rendering function (optimized for performance)
function createBiomarkerChart(biomarkerElement, biomarkerName) {
    if (!biomarkerElement) {
        console.warn(`Element for biomarker ${biomarkerName} not found`);
        return;
    }

    // IMPORTANT FIX: Set explicit dimensions BEFORE getting dimensions
    biomarkerElement.style.width = '100%';
    biomarkerElement.style.height = '350px';
    biomarkerElement.style.minHeight = '300px';
    biomarkerElement.style.minWidth = '200px';
    biomarkerElement.style.display = 'block';

    // Force layout recalculation
    void biomarkerElement.offsetHeight;
    
    // Check if element is actually visible (has dimensions)
    let rect = biomarkerElement.getBoundingClientRect();
    
    // If element has zero dimensions, try to force a size calculation
    if (rect.width === 0 || rect.height === 0) {
        const parentRect = biomarkerElement.parentElement?.getBoundingClientRect() || {width: 0};
        rect = {
            width: parentRect.width || 350,  // Use parent width or fallback to 400px
            height: 350
        };
    }
    
    const files = window.__INITIAL_DATA__?.files || [];
    if (files.length === 0) {
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

    // Important: Determine available width for better responsiveness
    // We use a minimum of 350px width to ensure proper rendering in all cases
    const containerWidth = Math.max(rect.width, 350);
    const containerHeight = Math.max(rect.height, 300);
    
    // Adjust margins based on container size
    const margins = {
        l: containerWidth < 350 ? 40 : 50,
        r: 30,
        t: 80,
        b: 60
    };
    
    // Calculate the automatic y-axis ticks that Plotly will generate
    const yAxisTicks = [];
    const tickStep = calculateTickInterval(yMax - yMin);
    for (let tick = Math.floor(yMin / tickStep) * tickStep; tick <= yMax; tick += tickStep) {
        yAxisTicks.push(parseFloat(tick.toFixed(6)));
    }
    
    // Create annotations array for reference range labels
    const annotations = [];

    // Only add reference annotations if they don't exactly match an axis tick
    if (!isValueInArray(minRef, yAxisTicks)) {
        annotations.push({
            x: 0,
            xref: 'paper',
            y: minRef,
            yref: 'y',
            text: minRef.toFixed(1),
            showarrow: false,
            font: {
                family: 'Arial, sans-serif',
                size: 10,
                color: '#777',
                weight: 'bold'
            },
            align: 'right',
            xanchor: 'right'
        });
    }

    if (!isValueInArray(maxRef, yAxisTicks)) {
        annotations.push({
            x: 0,
            xref: 'paper',
            y: maxRef,
            yref: 'y',
            text: maxRef.toFixed(1),
            showarrow: false,
            font: {
                family: 'Arial, sans-serif',
                size: 10,
                color: '#777',
                weight: 'bold'
            },
            align: 'right',
            xanchor: 'right'
        });
    }

    // Always add unit label annotation
    annotations.push({
        x: containerWidth < 350 ? -0.12 : -0.08,
        y: 1.14, 
        xref: 'paper',
        yref: 'paper',
        text: unit,
        showarrow: false,
        font: {
            family: 'Arial, sans-serif',
            size: containerWidth < 350 ? 12 : 14,
            color: '#666'
        },
        align: 'left'
    });

    // Find the center point for each year
    const yearCenters = {};
    dates.forEach(date => {
        const year = date.getFullYear();
        if (!yearCenters[year]) {
            const datesInYear = dates.filter(d => d.getFullYear() === year);
            const minDate = new Date(Math.min(...datesInYear.map(d => d.getTime())));
            const maxDate = new Date(Math.max(...datesInYear.map(d => d.getTime())));
            yearCenters[year] = new Date((minDate.getTime() + maxDate.getTime()) / 2);
        }
    });

    // Create year annotations
    const yearAnnotations = Object.entries(yearCenters).map(([year, centerDate]) => ({
        x: centerDate,
        y: -0.18, // Position below x-axis
        xref: 'x',
        yref: 'paper',
        text: year,
        showarrow: false,
        font: {
            family: 'Arial, sans-serif',
            size: containerWidth < 350 ? 10 : 12,
            color: '#888'
        },
        textangle: 0
    }));

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
            tickformat: '%b', // Only show month abbreviation
            tickfont: {
                family: 'Arial, sans-serif',
                size: containerWidth < 350 ? 10 : 12,
                color: '#666'
            },
            range: [
                // Expand range to show at least 5 months
                new Date(Math.min(...dates) - 60 * 24 * 60 * 60 * 1000),  // 60 days before earliest date
                new Date(Math.max(...dates) + 60 * 24 * 60 * 60 * 1000)   // 60 days after latest date
            ],
            showspikes: true,
            spikethickness: 1,
            spikedash: 'dot',
            spikecolor: '#999',
            spikemode: 'across',
            // Ensure we show multiple months if they exist
            tickmode: 'array',
            tickvals: (function() {
                // If we have few data points, create 5 month ticks centered around data
                if (dates.length <= 3) {
                    const centerDate = dates.length === 0 ? new Date() : 
                                       new Date((Math.min(...dates.map(d => d.getTime())) + 
                                                Math.max(...dates.map(d => d.getTime()))) / 2);
                    
                    // Create array of 5 months centered on data
                    return [-2, -1, 0, 1, 2].map(monthOffset => {
                        const date = new Date(centerDate);
                        date.setMonth(date.getMonth() + monthOffset);
                        return new Date(date.getFullYear(), date.getMonth(), 15);
                    });
                } else {
                    // If we have more data points, use those with a bit of padding
                    const uniqueMonths = Array.from(new Set(dates.map(d => 
                        new Date(d.getFullYear(), d.getMonth(), 15).getTime()
                    ))).map(timestamp => new Date(timestamp));
                    
                    // Sort dates chronologically
                    uniqueMonths.sort((a, b) => a - b);
                    
                    // If we have less than 5 unique months, add months on either side
                    if (uniqueMonths.length < 5) {
                        const padding = Math.ceil((5 - uniqueMonths.length) / 2);
                        
                        // Add months before
                        for (let i = 1; i <= padding; i++) {
                            const firstDate = new Date(uniqueMonths[0]);
                            firstDate.setMonth(firstDate.getMonth() - i);
                            uniqueMonths.unshift(firstDate);
                        }
                        
                        // Add months after
                        for (let i = 1; i <= padding; i++) {
                            const lastDate = new Date(uniqueMonths[uniqueMonths.length - 1]);
                            lastDate.setMonth(lastDate.getMonth() + i);
                            uniqueMonths.push(lastDate);
                        }
                    }
                    
                    return uniqueMonths;
                }
            })(),
            showticklabels: true
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
                size: containerWidth < 350 ? 10 : 12,
                color: '#666'
            },
            title: null
        },
        annotations: [...annotations, ...yearAnnotations],
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
        // Check if element already has a plotly chart
        const existingPlot = document.getElementById(biomarkerElement.id)?.querySelector('.plotly');
        
        if (existingPlot) {
            // Update existing plot 
            Plotly.react(biomarkerElement.id, [trace], layout, config);
        } else {
            // Create new plot
            Plotly.newPlot(biomarkerElement.id, [trace], layout, config);
        }
    } catch (error) {
        console.error(`Exception creating chart for ${biomarkerName}:`, error);
    }
}

// Optimized function to process visible charts only
function processVisibleCharts() {
    // Track processed charts to avoid duplicates
    const processedCharts = new Set();
    
    // Process charts from active tab first
    const activeTab = document.querySelector('.w-tab-pane.w--tab-active');
    if (activeTab) {
        processChartsInContainer(activeTab, processedCharts);
    }
}

// Process charts within a specific container
function processChartsInContainer(container, processedCharts) {
    if (!container) return;
    
    const biomarkers = window.__INITIAL_DATA__?.biomarkers || [];
    if (biomarkers.length === 0) return;
    
    // Find all chart elements in the container
    const chartElements = Array.from(container.querySelectorAll('[id^="biomarker-trend-"]'));
    
    // Process each chart element
    chartElements.forEach(element => {
        // Skip if already processed
        if (processedCharts.has(element.id)) return;
        processedCharts.add(element.id);
        
        // Find biomarker name from element ID
        const elementId = element.id;
        let biomarkerName = null;
        
        // Try to match biomarker name from element ID
        for (const name of biomarkers) {
            const standardizedName = name.toLowerCase().replace(/[\s()]/g, '').replace(/[-+]/g, '');
            if (elementId.includes(standardizedName)) {
                biomarkerName = name;
                break;
            }
        }
        
        if (biomarkerName) {
            // Process chart without extra DOM operations
            createBiomarkerChart(element, biomarkerName);
        }
    });
}

// Main chart initialization function with debouncing
let initializationInProgress = false;
function initializeBiomarkerCharts() {
    // Skip if already running
    if (initializationInProgress) return;
    initializationInProgress = true;
    
    // Try to find proper biomarker data
    if (!window.__INITIAL_DATA__?.biomarkers) {
        console.warn('No biomarker data found in __INITIAL_DATA__');
        initializationInProgress = false;
        return;
    }
    
    // Process charts with visibility checking
    processVisibleCharts();
    
    // Release lock after a short delay
    setTimeout(() => {
        initializationInProgress = false;
    }, 100);
}

/// Event handlers and lifecycle functions

// Tab change handler
function setupTabChangeHandlers() {
    // Add event listeners to all tab links once
    document.querySelectorAll('.w-tab-link').forEach(tab => {
        tab.addEventListener('click', function() {
            // Get the target tab ID
            const targetTabId = this.getAttribute('data-w-tab');
            
            // Wait for tab change animation to complete 
            setTimeout(() => {
                // Find the active tab based on the pane, not the link
                const activeTab = document.querySelector('.w-tab-pane.w--tab-active');
                if (activeTab) {
                    // Process charts in the newly activated tab
                    processVisibleCharts();
                }
            }, 350); // Slightly longer than the tab transition
        });
    });
    
    // Handle biomarker container expansion/collapse events
    document.querySelectorAll('.biomarker-container').forEach(container => {
        container.addEventListener('click', function(e) {
            // If this container has been expanded and contains a chart
            if (this.classList.contains('expanded')) {
                const chartElement = this.querySelector('[id^="biomarker-trend-"]');
                if (chartElement) {
                    // Resize the chart after a short delay to ensure the container is fully expanded
                    setTimeout(() => {
                        try {
                            Plotly.Plots.resize(chartElement);
                        } catch (err) {
                            console.warn('Error resizing chart:', err);
                        }
                    }, 300);
                }
            }
        });
    });
}

// Initialize when DOM is ready - one-time setup
document.addEventListener('DOMContentLoaded', function() {
    // Add temporary styling classes
    addTemporaryStyling();
    
    // Check if __INITIAL_DATA__ is available
    if (!window.__INITIAL_DATA__) {
        console.error('__INITIAL_DATA__ not found. Charts cannot be initialized.');
        return;
    }

    // Set up tab change handlers
    setupTabChangeHandlers();
    
    // Initial chart rendering - only once DOM is ready
    setTimeout(() => {
        initializeBiomarkerCharts();
        
        // Final resize after everything else is done
        window.addEventListener('load', function() {
            // Single resize once window is fully loaded (images, etc.)
            setTimeout(forcePlotlyRender, 300);
        });
    }, 300); // Slight delay to ensure DOM is stable
});

// Re-initialize on window resize for responsive behavior
let resizeTimeout;
window.addEventListener('resize', function() {
    // Use a debounce to prevent too many updates
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
        forcePlotlyRender();
    }, 300);
});