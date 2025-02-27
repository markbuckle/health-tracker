class WellnessScore {
    constructor() {
        // Get the scores passed from the server
        this.scores = JSON.parse(document.getElementById('wellnessData').dataset.scores);
        this.recommendations = JSON.parse(document.getElementById('wellnessData').dataset.recommendations);
        
        this.initializeUI();
        this.updateUI();
    }

    updateCircularChart(category, score) {
        const circumference = 2 * Math.PI * 15.915494309189533; // r = 100 / 2π
        const arc = document.getElementById(`${category}Progress`);
        const offset = circumference - (score / 100) * circumference;
        
        arc.style.strokeDasharray = `${circumference} ${circumference}`;
        arc.style.strokeDashoffset = offset;
    }

    initializeUI() {
        this.setupCircularCharts();
        
        // Add event listeners for metric items
        document.querySelectorAll('.metric-item').forEach(item => {
            item.addEventListener('click', () => this.showMetricDetails(item));
        });
    }

    setupCircularCharts() {
        const radius = 40; // Slightly smaller to fit stroke width
        const circumference = 2 * Math.PI * radius;
        
        ['prevention', 'monitoring', 'risk'].forEach((category, index) => {
            const startAngle = (index * 120) * (Math.PI / 180);
            const endAngle = ((index + 1) * 120) * (Math.PI / 180);
            
            const x = 50 + radius * Math.cos(startAngle);
            const y = 50 + radius * Math.sin(startAngle);
            const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;
            
            const x2 = 50 + radius * Math.cos(endAngle);
            const y2 = 50 + radius * Math.sin(endAngle);
            
            const bgPath = `M ${x} ${y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
            document.getElementById(`${category}Arc`).setAttribute('d', bgPath);
            
            const progressPath = document.getElementById(`${category}Progress`);
            progressPath.setAttribute('d', bgPath);
            progressPath.style.strokeDasharray = `${circumference} ${circumference}`;
        });
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
        // Update category scores and charts
        Object.entries(this.scores).forEach(([category, metrics]) => {
            const score = this.calculateScore(metrics);
            document.getElementById(`${category}Score`).textContent = Math.round(score);
            this.updateCircularChart(category, score);
        });

        // Calculate and update overall score
        const overallScore = this.calculateOverallScore();
        document.getElementById('overallScore').textContent = Math.round(overallScore);

        // Update recommendations
        const recommendationsList = document.getElementById('recommendationsList');
        recommendationsList.innerHTML = this.recommendations
            .map(rec => `<div class="recommendation-item">${rec}</div>`)
            .join('');
    }

    calculateScore(metrics) {
        const totalMetrics = Object.keys(metrics).length;
        const completedMetrics = Object.values(metrics).filter(Boolean).length;
        return (completedMetrics / totalMetrics) * 100;
    }

    calculateOverallScore() {
        const categoryScores = Object.entries(this.scores).map(([category, metrics]) => 
            this.calculateScore(metrics)
        );
        return categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
    }

    showMetricDetails(item) {
        // Add any click handling for metrics here
        console.log('Metric clicked:', item.dataset.metric);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.wellnessScore = new WellnessScore();
});