// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // --- CHART INSTANCES ---
    let messageActivityChart = null;
    let responseRateChart = null;

    // --- DOM REFERENCES ---
    const totalMessagesEl = document.getElementById('total-messages');
    const activeChatsEl = document.getElementById('active-chats');
    const responseRateEl = document.getElementById('response-rate');

    // --- RENDER FUNCTIONS ---
    const updateStatCards = (data) => {
        totalMessagesEl.textContent = data.total_messages_sent.toLocaleString() || '0';
        activeChatsEl.textContent = data.active_chats_24h.toLocaleString() || '0';
        responseRateEl.textContent = `${parseFloat(data.response_rate_all_time || 0).toFixed(1)}%`;
    };

    const renderMessageActivityChart = (activityData) => {
        const ctx = document.getElementById('messageActivityChart').getContext('2d');
        
        // Prepare labels and data for the last 7 days
        const labels = [];
        const dataPoints = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const formattedDate = date.toISOString().split('T')[0];
            labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
            
            const activityForDay = activityData.find(d => d.date === formattedDate);
            dataPoints.push(activityForDay ? activityForDay.count : 0);
        }

        if (messageActivityChart) messageActivityChart.destroy();
        messageActivityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Messages Sent',
                    data: dataPoints,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.2,
                    fill: false,
                }],
            },
            options: { maintainAspectRatio: false, responsive: true }
        });
    };

    const renderResponseRateChart = (rateData) => {
        const ctx = document.getElementById('responseRateChart').getContext('2d');
        
        const labels = rateData.map(d => `Week ${d.week.toString().slice(-2)}`);
        const dataPoints = rateData.map(d => parseFloat(d.responsePercentage).toFixed(1));

        if (responseRateChart) responseRateChart.destroy();
        responseRateChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Response Rate (%)',
                    data: dataPoints,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                }],
            },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    };

    // --- API & DATA HANDLING ---
    const fetchDashboardData = async () => {
        try {
            const response = await fetch('/api/data/dashboard-analytics');
            if (!response.ok) throw new Error('Failed to fetch analytics');
            const data = await response.json();

            updateStatCards(data);
            renderMessageActivityChart(data.weekly_message_activity || []);
            renderResponseRateChart(data.weekly_response_rate || []);

        } catch (error) {
            console.error('Error loading dashboard:', error);
            // You could show an error message on the dashboard here
        }
    };

    // --- INITIALIZATION ---
    fetchDashboardData();
});