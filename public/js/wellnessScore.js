// Add this at the beginning of your wellnessScore.js file
document.addEventListener('DOMContentLoaded', function() {
    // Check if wellnessData element exists before initializing
    const wellnessDataElement = document.getElementById('wellnessData');
    if (!wellnessDataElement) {
      console.warn('Wellness data element not found. Skipping initialization.');
      return;
    }
    
    try {
      // Only initialize if data exists
      window.wellnessScore = new WellnessScore();
    } catch(error) {
      console.error('Error initializing wellness score:', error);
    }
  });

  class WellnessScore {
    constructor() {
        try {
            // Check if required elements exist
            const wellnessData = document.getElementById('wellnessData');
            if (!wellnessData) {
                console.warn('Wellness data element not found. Skipping initialization.');
                return;
            }
            
            // Safely parse data with fallbacks
            try {
                this.scores = JSON.parse(wellnessData.dataset.scores || '{}');
            } catch (e) {
                console.warn('Error parsing scores data:', e);
                this.scores = {};
            }
            
            try {
                this.recommendations = JSON.parse(wellnessData.dataset.recommendations || '[]');
            } catch (e) {
                console.warn('Error parsing recommendations:', e);
                this.recommendations = [];
            }
            
            this.initializeUI();
            this.updateUI();
        } catch (error) {
            console.error('Error initializing WellnessScore:', error);
        }
    }

    updateCircularChart(category, score) {
        try {
            const arc = document.getElementById(`${category}Progress`);
            if (!arc) {
                console.warn(`Element ${category}Progress not found`);
                return;
            }
            
            const circumference = 2 * Math.PI * 15.915494309189533;
            const offset = circumference - (score / 100) * circumference;
            
            arc.style.strokeDasharray = `${circumference} ${circumference}`;
            arc.style.strokeDashoffset = offset;
        } catch (error) {
            console.warn(`Error updating circular chart for ${category}:`, error);
        }
    }

    initializeUI() {
        try {
            this.setupCircularCharts();
            
            // Add event listeners for metric items safely
            const metricItems = document.querySelectorAll('.metric-item');
            if (metricItems && metricItems.length > 0) {
                metricItems.forEach(item => {
                    if (item) {
                        item.addEventListener('click', () => this.showMetricDetails(item));
                    }
                });
            }
        } catch (error) {
            console.error('Error initializing UI:', error);
        }
    }

    setupCircularCharts() {
        try {
            const radius = 40; // Slightly smaller to fit stroke width
            
            ['prevention', 'monitoring', 'risk'].forEach((category, index) => {
                try {
                    // Check if elements exist
                    const arc = document.getElementById(`${category}Arc`);
                    const progressPath = document.getElementById(`${category}Progress`);
                    
                    if (!arc || !progressPath) {
                        console.warn(`Elements for ${category} not found`);
                        return;
                    }
                    
                    const startAngle = (index * 120) * (Math.PI / 180);
                    const endAngle = ((index + 1) * 120) * (Math.PI / 180);
                    
                    const x = 50 + radius * Math.cos(startAngle);
                    const y = 50 + radius * Math.sin(startAngle);
                    const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;
                    
                    const x2 = 50 + radius * Math.cos(endAngle);
                    const y2 = 50 + radius * Math.sin(endAngle);
                    
                    const bgPath = `M ${x} ${y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
                    arc.setAttribute('d', bgPath);
                    
                    progressPath.setAttribute('d', bgPath);
                    const circumference = 2 * Math.PI * radius;
                    progressPath.style.strokeDasharray = `${circumference} ${circumference}`;
                } catch (e) {
                    console.warn(`Error setting up circular chart for ${category}:`, e);
                }
            });
        } catch (error) {
            console.error('Error setting up circular charts:', error);
        }
    }

    describeArc(x, y, radius, startAngle, endAngle) {
        const start = {
            x: x + radius * Math.cos(startAngle),
            y: y + radius * Math.sin(startAngle)
        };
        
        const end = {
            x: x + radius * Math.cos(endAngle),
            y: y + radius * Math.sin(endAngle)
        };
        
        const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;
        
        return [
            'M', start.x, start.y,
            'A', radius, radius, 0, largeArc, 1, end.x, end.y
        ].join(' ');
    }

    updateUI() {
        try {
            if (!this.scores) {
                console.warn('No scores data available');
                return;
            }
            
            // Update category scores and charts
            Object.entries(this.scores || {}).forEach(([category, metrics]) => {
                try {
                    const scoreElement = document.getElementById(`${category}Score`);
                    if (!scoreElement) {
                        console.warn(`Score element for ${category} not found`);
                        return;
                    }
                    
                    const score = this.calculateScore(metrics);
                    scoreElement.textContent = Math.round(score);
                    this.updateCircularChart(category, score);
                } catch (e) {
                    console.warn(`Error updating UI for ${category}:`, e);
                }
            });

            // Calculate and update overall score
            try {
                const overallScore = this.calculateOverallScore();
                const overallScoreElement = document.getElementById('overallScore');
                if (overallScoreElement) {
                    overallScoreElement.textContent = Math.round(overallScore);
                }
            } catch (e) {
                console.warn('Error updating overall score:', e);
            }

            // Update recommendations
            try {
                const recommendationsList = document.getElementById('recommendationsList');
                if (recommendationsList && this.recommendations) {
                    recommendationsList.innerHTML = this.recommendations
                        .map(rec => `<div class="recommendation-item">${rec}</div>`)
                        .join('');
                }
            } catch (e) {
                console.warn('Error updating recommendations:', e);
            }
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }

    calculateScore(metrics) {
        try {
            if (!metrics) return 0;
            
            const totalMetrics = Object.keys(metrics).length;
            if (totalMetrics === 0) return 0;
            
            const completedMetrics = Object.values(metrics).filter(Boolean).length;
            return (completedMetrics / totalMetrics) * 100;
        } catch (error) {
            console.warn('Error calculating score:', error);
            return 0;
        }
    }

    calculateOverallScore() {
        try {
            if (!this.scores) return 0;
            
            const categoryScores = Object.entries(this.scores).map(([category, metrics]) => 
                this.calculateScore(metrics)
            );
            
            if (categoryScores.length === 0) return 0;
            
            return categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
        } catch (error) {
            console.warn('Error calculating overall score:', error);
            return 0;
        }
    }

    showMetricDetails(item) {
        try {
            // Add any click handling for metrics here
            if (item && item.dataset) {
                console.log('Metric clicked:', item.dataset.metric);
            }
        } catch (error) {
            console.warn('Error showing metric details:', error);
        }
    }
}

// Safe initialization
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Check if wellnessData element exists before initializing
        const wellnessDataElement = document.getElementById('wellnessData');
        if (!wellnessDataElement) {
            console.warn('Wellness data element not found. Skipping WellnessScore initialization.');
            return;
        }
        
        window.wellnessScore = new WellnessScore();
    } catch (error) {
        console.error('Failed to initialize WellnessScore:', error);
    }
});