// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // Common chart options, translated from your React component
    const chartOptions = {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    boxWidth: 12,
                    padding: 15,
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    // 1. Message Activity Chart (Line)
    const messageData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Messages Sent',
            data: [65, 59, 80, 81, 56, 55, 40],
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.2,
            fill: false,
        }],
    };

    const messageCtx = document.getElementById('messageActivityChart').getContext('2d');
    new Chart(messageCtx, {
        type: 'line',
        data: messageData,
        options: chartOptions,
    });


    // 2. Response Time Chart (Doughnut)
    const responseData = {
        labels: ['Immediate', 'Within 5min', 'Within 1hr', 'Later'],
        datasets: [{
            data: [300, 150, 100, 50],
            backgroundColor: [
                'rgba(75, 192, 192, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(255, 99, 132, 0.8)',
            ],
        }],
    };

    const responseCtx = document.getElementById('responseTimeChart').getContext('2d');
    new Chart(responseCtx, {
        type: 'doughnut',
        data: responseData,
        options: { // Doughnut charts might have slightly different default options
             maintainAspectRatio: false,
             responsive: true,
             plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                    },
                },
            },
        }
    });


    // 3. Conversion Rate Chart (Bar)
    const conversionData = {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [{
            label: 'Conversion Rate',
            data: [30, 45, 55, 60],
            backgroundColor: 'rgba(54, 162, 235, 0.5)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
        }],
    };

    const conversionCtx = document.getElementById('conversionRateChart').getContext('2d');
    new Chart(conversionCtx, {
        type: 'bar',
        data: conversionData,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
});