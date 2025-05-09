//// Enhanced biomarker trend charts function

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
    const style = document.createElement('style');
    style.textContent = `
        .temp-expand-for-render {
            height: auto !important;
            opacity: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            z-index: -1 !important;
            pointer-events: none !important;
        }
        
        .temp-open-for-render {
            display: block !important;
            opacity: 0 !important;
            overflow: hidden !important;
            position: absolute !important;
            z-index: -1 !important;
            pointer-events: none !important;
        }
    `;
    document.head.appendChild(style);
}

// Core chart rendering function (optimized for performance)
function createBiomarkerChart(biomarkerElement, biomarkerName) {
    if (!biomarkerElement) {
        console.warn(`Element for biomarker ${biomarkerName} not found`);
        return;
    }
    
    console.log(`Creating chart for biomarker: ${biomarkerName} in element:`, biomarkerElement.id);
    
    // Check if element is actually visible (has dimensions)
    let rect = biomarkerElement.getBoundingClientRect();
    
    // If element has zero dimensions, try to force a size calculation
    if (rect.width === 0 || rect.height === 0) {
        // Set explicit dimensions to ensure proper rendering
        biomarkerElement.style.width = '100%';
        biomarkerElement.style.height = '350px';
        biomarkerElement.style.minHeight = '300px';
        biomarkerElement.style.minWidth = '200px';
        biomarkerElement.style.display = 'block';
        
        // Force layout recalculation
        void biomarkerElement.offsetHeight;
        
        // Get updated dimensions
        rect = biomarkerElement.getBoundingClientRect();
        
        console.log(`Forced dimensions for ${biomarkerName}:`, {width: rect.width, height: rect.height});
        
        // If still zero dimensions, use fallback values
        if (rect.width === 0 || rect.height === 0) {
            // Try to get parent width
            const parentRect = biomarkerElement.parentElement?.getBoundingClientRect() || {width: 0};
            rect = {
                width: parentRect.width || 400,  // Use parent width or fallback to 400px
                height: 350
            };
            console.log(`Using fallback dimensions for ${biomarkerName}:`, rect);
        }
    }
    
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
    
    console.log(`Chart container dimensions for ${biomarkerName}:`, {width: containerWidth, height: containerHeight});
    
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
        height: containerHeight,
        width: containerWidth,
        autosize: true,
        margin: margins,
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

    // Track this operation in window for debugging
    window.lastPlotOperation = {
        elementId: biomarkerElement.id,
        biomarker: biomarkerName,
        timestamp: new Date().toISOString(),
        dimensions: {width: containerWidth, height: containerHeight}
    };

    try {
        // Clear any existing plot first
        Plotly.purge(biomarkerElement.id);
        
        // Create new plot with a promise chain for better error handling
        Plotly.newPlot(biomarkerElement.id, [trace], layout, config)
            .then(() => {
                console.log(`Successfully plotted chart for ${biomarkerName}`);
                
                // Force a resize after creation to ensure proper layout
                return Plotly.Plots.resize(document.getElementById(biomarkerElement.id));
            })
            .then(() => {
                // Schedule a second resize after everything else has finished
                setTimeout(() => {
                    try {
                        // Get current dimensions to check if they've changed
                        const currentRect = biomarkerElement.getBoundingClientRect();
                        console.log(`Delayed resize for ${biomarkerName}:`, {
                            width: currentRect.width, 
                            height: currentRect.height
                        });
                        
                        // Only resize if needed
                        if (currentRect.width > 0 && currentRect.height > 0) {
                            Plotly.Plots.resize(document.getElementById(biomarkerElement.id));
                        }
                    } catch (err) {
                        console.warn(`Error during delayed resize for ${biomarkerName}:`, err);
                    }
                }, 500);
            })
            .catch(error => {
                console.error(`Error plotting chart for ${biomarkerName}:`, error);
            });
    } catch (error) {
        console.error(`Exception creating chart for ${biomarkerName}:`, error);
    }
}

// Main chart initialization function
function initializeBiomarkerCharts() {
    console.log('Starting biomarker chart initialization');
    
    const biomarkers = window.__INITIAL_DATA__?.biomarkers || [];
    if (biomarkers.length === 0) {
        console.warn('No biomarkers found in __INITIAL_DATA__');
        return;
    }
    
    // Get current active tab
    const activeTab = document.querySelector('.w-tab-pane.w--tab-active');
    if (!activeTab) {
        console.warn('No active tab found');
        return;
    }
    
    console.log('Initializing charts in active tab:', activeTab.getAttribute('data-w-tab'));
    
    // Process only visible charts in the current tab
    const visibleChartElements = Array.from(activeTab.querySelectorAll('[id^="biomarker-trend-"]'));
    console.log(`Found ${visibleChartElements.length} chart elements in active tab`);
    
    // Function to process chart after ensuring visibility
    function processChart(element, biomarkerName) {
        // Set minimum height and width to ensure proper rendering
        element.style.minHeight = '300px';
        element.style.height = '350px';
        element.style.width = '100%';
        
        // If this chart is inside a collapsed container, temporarily make it visible for rendering
        const biomarkerContainer = element.closest('.biomarker-container');
        let wasExpanded = false;
        
        if (biomarkerContainer && !biomarkerContainer.classList.contains('expanded')) {
            biomarkerContainer.classList.add('temp-expand-for-render');
            wasExpanded = true;
        }
        
        // Short delay to allow DOM to update
        setTimeout(() => {
            createBiomarkerChart(element, biomarkerName);
            
            // Remove temporary expansion class if we added it
            if (wasExpanded) {
                setTimeout(() => {
                    biomarkerContainer.classList.remove('temp-expand-for-render');
                }, 100);
            }
        }, 50);
    }
    
    // Check each biomarker against available elements
    biomarkers.forEach(biomarker => {
        // Create standardized name for DOM ID matching
        const standardizedName = biomarker.toLowerCase()
            .replace(/[\s()]/g, '')
            .replace(/[-+]/g, '');
            
        // Find matching elements in the current active tab
        const matchingElements = visibleChartElements.filter(el => {
            const id = el.id.toLowerCase();
            return id.includes(standardizedName) || 
                   id.includes(biomarker.toLowerCase().replace(/[^a-z0-9]/g, ''));
        });
        
        if (matchingElements.length > 0) {
            console.log(`Found ${matchingElements.length} chart elements for ${biomarker}`);
            matchingElements.forEach(element => {
                processChart(element, biomarker);
            });
        }
    });
}

// Event handlers and lifecycle functions
function setupTabChangeHandlers() {
    // Add event listeners to all tab links
    document.querySelectorAll('.w-tab-link').forEach(tab => {
        tab.addEventListener('click', function() {
            // Get the target tab ID
            const targetTabId = this.getAttribute('data-w-tab');
            console.log(`Tab changed to: ${targetTabId}`);
            
            // Wait for tab change animation to complete
            setTimeout(() => {
                // Find all chart containers in the newly active tab
                const activeTab = document.querySelector('.w-tab-pane.w--tab-active');
                if (activeTab) {
                    // Check if there are any collapsed biomarker containers that need to be expanded
                    // for chart rendering
                    const collapsedContainers = activeTab.querySelectorAll('.biomarker-container:not(.expanded)');
                    
                    // If the tab has dropdown content, we need special handling
                    if (activeTab.querySelectorAll('.category-dropdown-list').length > 0) {
                        console.log('Tab contains dropdown categories, initializing charts with expanded view');
                        
                        // Special handling for category tabs - make sure dropdowns are visible
                        // for proper chart rendering
                        const dropdowns = activeTab.querySelectorAll('.category-dropdown-list');
                        let dropdownsOpen = false;
                        
                        dropdowns.forEach(dropdown => {
                            if (!dropdown.classList.contains('w--open')) {
                                dropdown.classList.add('temp-open-for-render');
                                dropdownsOpen = true;
                            }
                        });
                        
                        // Wait for DOM update before initializing charts
                        setTimeout(() => {
                            initializeBiomarkerCharts();
                            
                            // Remove temporary classes after charts are initialized
                            setTimeout(() => {
                                document.querySelectorAll('.temp-open-for-render').forEach(el => {
                                    el.classList.remove('temp-open-for-render');
                                });
                            }, 300);
                        }, 100);
                    } else {
                        // Standard tab, just initialize charts
                        initializeBiomarkerCharts();
                    }
                }
            }, 300); // Increase timeout for tab change animation
        });
    });
    // Also handle biomarker container expansion/collapse events
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

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing biomarker charts...');

    // Add temporary styling classes
    addTemporaryStyling();
    
    // Check if __INITIAL_DATA__ is available
    if (!window.__INITIAL_DATA__) {
        console.error('__INITIAL_DATA__ not found. Charts cannot be initialized.');
        return;
    }

    // Set up tab change handlers
    setupTabChangeHandlers();
    
    // Initialize charts
    initializeBiomarkerCharts();
    
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

// Create a function to manually trigger chart updates from console for debugging
window.updateAllCharts = function() {
    console.log('Manual chart update triggered');
    
    // Get current active tab
    const activeTab = document.querySelector('.w-tab-pane.w--tab-active');
    if (!activeTab) {
        console.warn('No active tab found');
        return 'Error: No active tab found';
    }
    
    console.log('Active tab:', activeTab.getAttribute('data-w-tab'));
    
    // Special handling for Category and Frequency tabs
    const tabId = activeTab.getAttribute('data-w-tab');
    if (tabId === 'Category' || tabId === 'Frequency') {
        // For Category and Frequency tabs, temporarily expand dropdowns
        const dropdowns = activeTab.querySelectorAll('.category-dropdown-list');
        let openedDropdowns = false;
        
        dropdowns.forEach(dropdown => {
            if (!dropdown.classList.contains('w--open')) {
                dropdown.classList.add('temp-open-for-render');
                openedDropdowns = true;
            }
        });
        
        // Force a layout recalculation
        void activeTab.offsetHeight;
        
        // Render with forced option
        initializeBiomarkerCharts(true);
        
        // Remove temporary classes after rendering
        if (openedDropdowns) {
            setTimeout(() => {
                document.querySelectorAll('.temp-open-for-render').forEach(el => {
                    el.classList.remove('temp-open-for-render');
                });
            }, 300);
        }
    } else {
        // For "All" tab, do a standard render
        initializeBiomarkerCharts(true);
    }
    
    // Schedule a second render after a delay to ensure everything is properly sized
    setTimeout(() => {
        console.log('Secondary render to ensure proper sizing');
        
        // Resize any existing charts first
        try {
            const chartElements = activeTab.querySelectorAll('[id^="biomarker-trend-"]');
            chartElements.forEach(el => {
                if (el.id && document.getElementById(el.id)) {
                    try {
                        Plotly.Plots.resize(document.getElementById(el.id));
                    } catch (err) {
                        // Ignore errors from elements that aren't Plotly charts
                    }
                }
            });
        } catch (err) {
            console.warn('Error resizing charts:', err);
        }
        
        // Then do a full re-render
        initializeBiomarkerCharts(true);
    }, 500);
    
    return 'Chart update sequence started - check console for details';
};