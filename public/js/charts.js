// Add this helper function at the start
function findLabValue(file, name) {
    // Get the biomarker data and its alternate names
    const biomarkerInfo = window.__INITIAL_DATA__?.biomarkerInfo?.[name];
    const possibleNames = [name, ...(biomarkerInfo?.alternateNames || [])];
    
    // Try the standard format first
    for (const possibleName of possibleNames) {
        let value = null;

        // Check if labValues is a Map or an Object
        if (file.labValues instanceof Map) {
            value = file.labValues.get(possibleName);
        } else {
            value = file.labValues?.[possibleName];
        }

        if (value) {
            return {
                value: parseFloat(value.value),
                unit: value.unit,
                referenceRange: value.referenceRange?.replace(/\s+/g, '')  // Remove spaces
            };
        }
    }
    return null;
}

function createBiomarkerChart(biomarkerElement, biomarkerName) {
    // Debug current tab and element state
    const parentTab = biomarkerElement.closest('[data-w-tab]');
    const tabId = parentTab?.getAttribute('data-w-tab');

    const files = window.__INITIAL_DATA__?.files || [];

    // Transform and sort the data
    const chartData = files
        .filter(file => {
            const value = findLabValue(file, biomarkerName);
            return value !== null;
            // return value;
        })
        .map(file => {
            const labValue = findLabValue(file, biomarkerName);
            const data = {
                date: new Date(file.testDate),
                value: parseFloat(labValue.value),
                unit: labValue.unit,
                referenceRange: labValue.referenceRange
            };
            return data;
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
    const [minRef, maxRef] = referenceRange.split('-').map(Number);

    // Add validation to ensure we have valid numbers
    // if (isNaN(minRef) || isNaN(maxRef)) {
    //     console.warn(`Invalid reference range for ${biomarkerName}: ${referenceRange}`);
    //     return; // or set default values if preferred
    // }

    // console.log(`Reference Range for ${biomarkerName}:`, { minRef, maxRef, referenceRange });

    // Create arrays for each range
    const lowRange = {
        x: [],
        y: []
    };
    
    const normalRange = {
        x: [],
        y: []
    };
    
    const highRange = {
        x: [],
        y: []
    };

    // Helper function to categorize values
    function categorizeValue(value) {
        if (value < minRef) return 'low';
        if (value > maxRef) return 'high';
        return 'normal';
    }

    // Process each data point and create connecting points
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
            showlegend: false,
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
            showlegend: false,
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
            showlegend: false,
            hoverinfo: 'none'
        });
    }

    // Add markers
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
        showlegend: false,
        hovertemplate: '%{x|%B %d, %Y}<br>%{y:.2f} ' + unit + '<extra></extra>',
        hoverlabel: {
            font: {
                family: 'Poppins-Regular, sans-serif',
                color: 'white'
            }
        }
    });

     // Create a simpler test plot for debugging
     const plotData = [{
        x: chartData.map(d => d.date),
        y: chartData.map(d => d.value),
        type: 'scatter',
        mode: 'lines+markers',
        name: biomarkerName
    }];

    const layout = {
        title: {
            text: `${biomarkerName} Levels Over Time`,
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
        height: 400,
        width: null,
        autosize: true,
        margin: { l: 30, r: 30, t: 60, b: 40 },
        responsive: true, // Add responsive behaviors
        aspectratio: { x: 1, y: 1 }, // Ensure it maintains aspect ratio
        frameMargins: 0, // Force frame settings
        // Add this as a container style
        style: {
            width: '100%',
            height: '100%'
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        hovermode: 'closest',
        xaxis: {
            showgrid: false,
            gridcolor: '#E5E5E5',
            tickformat: '%B',
            zeroline: false,
            fixedrange: true,
            showline: true,
            tickangle: 0,
            showspikes: true,
            spikemode: 'across',
            spikesnap: 'data',
            spikecolor: '#bbb',
            spikedash: 'dot',
            spikethickness: 1,
            hovermode: 'closest',
            hoverdistance: 1,
            tickfont: {
                family: 'Poppins-Regular, sans-serif',
                size: 12,
                color: '#000'
            },
            range: [
                new Date(new Date(Math.min(...dates)).setMonth(new Date(Math.min(...dates)).getMonth() - 1.02)),
                new Date(new Date(Math.max(...dates)).setMonth(new Date(Math.max(...dates)).getMonth() + 1.02))
            ],
            tickmode: 'array',
            ticktext: dates.map(d => d.toLocaleString('en-US', { month: 'long' })),
            tickvals: dates
        },
        yaxis: {
            showgrid: true,
            gridcolor: '#E5E5E5',
            fixedrange: true,
            showline: true,
            range: [
                Math.floor(Math.min(...values) * 0.9),  // Round to whole numbers
                Math.ceil(Math.max(...values) * 1.1)
            ],
            tickformat: '.2f',  // Keep 2 decimal places
            tickfont: {
                family: 'Poppins-Regular',
                size: 12,
                color: '#000'
            },
            side: 'left',
            position: -0.15,
            tickmode: 'array',
            // ticktext: ['0.00', '1.00', '2.00', '3.00', '4.00', '5.00', '6.00', '7.00', '8.00', '9.00', '10.00', '11.00', '12.00', '13.00', '14.00', '15.00', '16.00', '17.00', '18.00'],
            // tickvals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
            title: {
                text: unit,
                font: {
                    family: 'Poppins-Regular',
                    size: 12,
                    color: '#000'
                },
                standoff: 30
            },
            ticksuffix: '  ',
            layer: 'below traces',
            zeroline: false,
            automargin: true
        }
    };

    const config = {
        displayModeBar: false,
        responsive: true,
        modeBarButtonsToRemove: ['autoScale2d'] // Add specific responsive rules
    };

    Plotly.newPlot(biomarkerElement.id, traces, layout, config, plotData).then(() => {
        // Force a relayout to ensure proper sizing
        Plotly.Plots.resize(biomarkerElement);
        // Fix the y-axis unit label rotation
        const fixYAxisRotation = () => {
            // Wait a brief moment for Plotly to finish its rendering
            setTimeout(() => {
                const ytitleGroup = document.querySelector(`#${biomarkerElement.id} .g-ytitle`);
                const ytitleText = document.querySelector(`#${biomarkerElement.id} .g-ytitle text`);
                
                if (ytitleGroup && ytitleText) {
                    ytitleGroup.setAttribute('transform', 'translate(5,205)');
                    ytitleText.setAttribute('transform', 'rotate(0)');
                    ytitleText.setAttribute('x', '0');
                    ytitleText.setAttribute('y', '0');
                    ytitleText.style.textAnchor = 'start';

                    // Add style to prevent transitions
                    ytitleText.style.transition = 'none';
                    ytitleGroup.style.transition = 'none';
                }
            }, 100);
        };

        fixYAxisRotation();

        // Handle rotation fix on window resize
        const resizeObserver = new ResizeObserver(() => {
            fixYAxisRotation();
        });

        resizeObserver.observe(biomarkerElement);

        // Clean up
        biomarkerElement._cleanupFuncs = biomarkerElement._cleanupFuncs || [];
        biomarkerElement._cleanupFuncs.push(() => resizeObserver.disconnect());

        window.addEventListener('resize', fixYAxisRotation);
    });
}

// Initialize all biomarker charts
document.addEventListener('DOMContentLoaded', function() {
    const biomarkers = window.__INITIAL_DATA__?.biomarkers || [];
    
    // Your original working code
    function initializeCharts() {
        biomarkers.forEach(biomarker => {
            const standardizedName = biomarker.toLowerCase()
                .replace(/[()]/g, '')
                .replace(/\s+/g, '');
                
            // Try both regular and frequency-specific IDs
            const elementId = `biomarker-trend-${standardizedName}`;
            const freqElementId = `biomarker-trend-${standardizedName}-freq`;
            const allElementId = `biomarker-trend-${standardizedName}-all`;
            
            // Initialize charts for both IDs if they exist
            [elementId, freqElementId, allElementId].forEach(id => {
                const chartElement = document.getElementById(id);
                if (chartElement) {
                    try {
                        createBiomarkerChart(chartElement, biomarker);
                    } catch (error) {
                        console.error(`Error creating chart for ${biomarker} (${id}):`, error);
                    }
                }
            });
        });
    }

    // Initial load
    initializeCharts();

    // Simple tab change handler
    document.querySelectorAll('[data-w-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            // Re-run the original initialization after a delay
            setTimeout(initializeCharts, 250);
        });
    });
});
