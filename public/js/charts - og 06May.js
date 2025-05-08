// Enhanced biomarker trend charts function

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

// Improved function for creating biomarker trend charts
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
    
    console.log(`Found ${files.length} files to check for biomarker ${biomarkerName}`);

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
    
    console.log(`Found ${chartData.length} data points for biomarker: ${biomarkerName}`);
    
    // Log some debug information about the data
    console.log(`Chart data for ${biomarkerName}:`, chartData.map(d => ({
        date: d.date.toISOString().split('T')[0],
        value: d.value,
        unit: d.unit,
        range: d.referenceRange
    })));

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
        console.warn(`Invalid reference range for ${biomarkerName}, using min/max with padding: ${minRef}-${maxRef}`);
    }

    // Ensure we have valid numbers
    if (isNaN(minRef) || isNaN(maxRef)) {
        console.warn(`Invalid reference range for ${biomarkerName}, using min/max of data`);
        const padding = 0.1; // 10% padding
        minRef = Math.min(...values) * (1 - padding);
        maxRef = Math.max(...values) * (1 + padding);
    }

    // Create arrays for each range
    const lowRange = { x: [], y: [] };
    const normalRange = { x: [], y: [] };
    const highRange = { x: [], y: [] };

    // Helper function to categorize values
    function categorizeValue(value) {
        if (value < minRef) return 'low';
        if (value > maxRef) return 'high';
        return 'normal';
    }

    // Process each data point and create connecting points for lines
    for (let i = 0; i < values.length; i++) {
        const currentValue = values[i];
        const currentDate = dates[i];
        const currentCategory = categorizeValue(currentValue);
        
        if (i > 0) {
            const prevValue = values[i-1];
            const prevDate = dates[i-1];
            const prevCategory = categorizeValue(prevValue);
            
            // If categories are different, calculate intersection point
            if (prevCategory !== currentCategory) {
                const referenceValue = (currentCategory === 'low' || prevCategory === 'low') ? minRef : maxRef;
                const t = (referenceValue - prevValue) / (currentValue - prevValue);
                const intersectionDate = new Date(prevDate.getTime() + t * (currentDate.getTime() - prevDate.getTime()));

                // Add intersection point to both relevant ranges
                if (prevCategory === 'low' || currentCategory === 'low') {
                    lowRange.x.push(intersectionDate);
                    lowRange.y.push(referenceValue);
                    normalRange.x.push(intersectionDate);
                    normalRange.y.push(referenceValue);
                }
                if (prevCategory === 'high' || currentCategory === 'high') {
                    highRange.x.push(intersectionDate);
                    highRange.y.push(referenceValue);
                    normalRange.x.push(intersectionDate);
                    normalRange.y.push(referenceValue);
                }
            }
        }

        // Add point to appropriate range
        switch (currentCategory) {
            case 'low':
                lowRange.x.push(currentDate);
                lowRange.y.push(currentValue);
                break;
            case 'normal':
                normalRange.x.push(currentDate);
                normalRange.y.push(currentValue);
                break;
            case 'high':
                highRange.x.push(currentDate);
                highRange.y.push(currentValue);
                break;
        }
    }

    // Create traces for each range
    const traces = [];

    if (lowRange.x.length > 0) {
        traces.push({
            x: lowRange.x,
            y: lowRange.y,
            type: 'scatter',
            mode: 'lines',
            line: {
                color: '#EB656F',
                width: 3
            },
            name: 'Low',
            hoverinfo: 'none'
        });
    }

    if (normalRange.x.length > 0) {
        traces.push({
            x: normalRange.x,
            y: normalRange.y,
            type: 'scatter',
            mode: 'lines',
            line: {
                color: '#95DA74',
                width: 3
            },
            name: 'Normal',
            hoverinfo: 'none'
        });
    }

    if (highRange.x.length > 0) {
        traces.push({
            x: highRange.x,
            y: highRange.y,
            type: 'scatter',
            mode: 'lines',
            line: {
                color: '#EB656F',
                width: 3
            },
            name: 'High',
            hoverinfo: 'none'
        });
    }

    // Add markers with custom hover template
    traces.push({
        x: dates,
        y: values,
        type: 'scatter',
        mode: 'markers',
        marker: {
            size: 8,
            color: values.map(v => {
                if (v < minRef || v > maxRef) return '#EB656F';
                return '#95DA74';
            }),
            line: {
                color: '#000',
                width: 1
            }
        },
        name: biomarkerName,
        hovertemplate: '%{x|%b %d, %Y}<br>%{y:.2f} ' + unit + '<extra></extra>',
        hoverlabel: {
            font: {
                family: 'Poppins-Regular, sans-serif',
                color: 'white'
            }
        }
    });

    // Reference range lines
    traces.push({
        x: [dates[0], dates[dates.length - 1]],
        y: [minRef, minRef],
        type: 'scatter',
        mode: 'lines',
        line: {
            color: '#AAA',
            width: 1,
            dash: 'dash'
        },
        name: 'Min',
        hoverinfo: 'none'
    });

    traces.push({
        x: [dates[0], dates[dates.length - 1]],
        y: [maxRef, maxRef],
        type: 'scatter',
        mode: 'lines',
        line: {
            color: '#AAA',
            width: 1,
            dash: 'dash'
        },
        name: 'Max',
        hoverinfo: 'none'
    });

    const layout = {
        title: {
            text: `${biomarkerName} Levels`,
            font: {
                family: 'Poppins-Regular, sans-serif',
                size: 16,
                color: '#000'
            },
            y: 0.95,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top'
        },
        height: 350,
        autosize: true,
        margin: { l: 40, r: 30, t: 60, b: 40 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        hovermode: 'closest',
        showlegend: false,
        xaxis: {
            showgrid: false,
            gridcolor: '#E5E5E5',
            tickformat: '%b %y',
            zeroline: false,
            fixedrange: true,
            showline: true,
            showspikes: true,
            spikemode: 'across',
            spikesnap: 'cursor',
            spikecolor: '#bbb',
            spikethickness: 1,
            tickfont: {
                family: 'Poppins-Regular, sans-serif',
                size: 12,
                color: '#000'
            },
            range: [
                // Add a little padding before and after the data points
                new Date(Math.min(...dates) - 7 * 24 * 60 * 60 * 1000),
                new Date(Math.max(...dates) + 7 * 24 * 60 * 60 * 1000)
            ]
        },
        yaxis: {
            showgrid: true,
            gridcolor: '#E5E5E5',
            fixedrange: true,
            showline: true,
            range: [
                // Add some padding to y-axis range
                Math.min(Math.min(...values) * 0.9, minRef * 0.9),
                Math.max(Math.max(...values) * 1.1, maxRef * 1.1)
            ],
            tickformat: '.1f',  // Keep 1 decimal place
            tickfont: {
                family: 'Poppins-Regular, sans-serif',
                size: 12,
                color: '#000'
            },
            title: {
                text: unit,
                font: {
                    family: 'Poppins-Regular, sans-serif',
                    size: 12,
                    color: '#000'
                },
                standoff: 10
            }
        },
        annotations: [
            {
                x: dates[0],
                y: minRef,
                xref: 'x',
                yref: 'y',
                text: minRef.toFixed(1),
                showarrow: false,
                font: {
                    family: 'Poppins-Regular, sans-serif',
                    size: 10,
                    color: '#777'
                },
                xanchor: 'right',
                yanchor: 'bottom',
                xshift: -5
            },
            {
                x: dates[0],
                y: maxRef,
                xref: 'x',
                yref: 'y',
                text: maxRef.toFixed(1),
                showarrow: false,
                font: {
                    family: 'Poppins-Regular, sans-serif',
                    size: 10,
                    color: '#777'
                },
                xanchor: 'right',
                yanchor: 'top',
                xshift: -5
            }
        ]
    };

    const config = {
        displayModeBar: false,
        responsive: true,
        scrollZoom: false,
        staticPlot: false
    };

    // Check if the element is visible (may impact chart rendering)
    const isVisible = isElementInVisibleTab(biomarkerElement);
    console.log(`Element ${biomarkerElement.id} visibility:`, isVisible);

    try {
        Plotly.newPlot(biomarkerElement.id, traces, layout, config)
            .then(() => {
                console.log(`Successfully plotted chart for ${biomarkerName}`);
                
                // Fix the y-axis unit label rotation
                const fixYAxisRotation = () => {
                    setTimeout(() => {
                        const ytitleGroup = document.querySelector(`#${biomarkerElement.id} .g-ytitle`);
                        const ytitleText = document.querySelector(`#${biomarkerElement.id} .g-ytitle text`);
                        
                        if (ytitleGroup && ytitleText) {
                            ytitleGroup.setAttribute('transform', 'translate(5,175)');
                            ytitleText.setAttribute('transform', 'rotate(0)');
                            ytitleText.setAttribute('x', '0');
                            ytitleText.setAttribute('y', '0');
                            ytitleText.style.textAnchor = 'start';
                            ytitleText.style.transition = 'none';
                            ytitleGroup.style.transition = 'none';
                        }
                    }, 100);
                };

                fixYAxisRotation();

                // Handle rotation fix on window resize
                if (!biomarkerElement._resizeObserver) {
                    const resizeObserver = new ResizeObserver(() => {
                        fixYAxisRotation();
                        Plotly.Plots.resize(biomarkerElement);
                    });
                    resizeObserver.observe(biomarkerElement);
                    biomarkerElement._resizeObserver = resizeObserver;
                }
            })
            .catch(error => {
                console.error(`Error plotting chart for ${biomarkerName}:`, error);
            });
    } catch (error) {
        console.error(`Exception creating chart for ${biomarkerName}:`, error);
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