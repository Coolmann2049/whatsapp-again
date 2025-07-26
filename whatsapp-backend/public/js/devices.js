let devices = [{
        id: 1,
        name: 'Primary Phone',
        status: 'connected',
        lastActive: '2024-01-20 14:30'
    }];
let selectedDevice = null;

document.addEventListener('DOMContentLoaded', () => {

    intializeSocket();

    setupEventListeners();

    renderDevices();
});


function handleSendTestMessage  () {
    const testMessageModal = new bootstrap.Modal(document.getElementById('testMessageModal'));
    const testNumberInput = document.getElementById('test-number');
    const testMessageInput = document.getElementById('test-message');

    const number = testNumberInput.value.trim();
    const message = testMessageInput.value.trim();
    
    if (!number || !message) {
        showAlert('Please fill in all fields to send a test message.', 'danger');
        return;
    }

    console.log(`Sending to ${number}: "${message}" from device ID ${selectedDevice.id}`);
    showAlert('Test message sent successfully!');
    testMessageModal.hide();
    testNumberInput.value = '';
    testMessageInput.value = '';
}

const handleListActions = (e) => {
    const testMessageModal = new bootstrap.Modal(document.getElementById('testMessageModal'));
    const target = e.target.closest('button');
    if (!target) return;
    
    const deviceId = parseInt(target.dataset.id);

    if (target.classList.contains('btn-delete')) {
        if (confirm('Are you sure you want to remove this device?')) {
            devices = devices.filter(d => d.id !== deviceId);
            renderDevices();
            showAlert('Device removed successfully!');
        }
    } else if (target.classList.contains('btn-test')) {
        selectedDevice = devices.find(d => d.id === deviceId);
        testMessageModal.show();
    }
};

async function renderDevices() {
    const devicesListContainer = document.getElementById('devicesListContainer');

    if (!devicesListContainer) {
        console.error("Devices list container not found");
        return;
    }

    devicesListContainer.innerHTML = ''; // Clear list
    if (devices.length === 0) {
        // Empty state
        const emptyStateHtml = `
            <div class="text-center py-5 px-3">
                <i class="bi bi-phone text-muted" style="font-size: 3rem;"></i>
                <h6 class="text-muted mt-3 mb-2">No devices connected</h6>
                <p class="text-muted small mb-0">Pair your first device to get started</p>
            </div>
        `;
        devicesListContainer.insertAdjacentHTML('beforeend', emptyStateHtml);
    } else {
        devices.forEach((device, index) => {
            const statusColor = device.status === 'connected' ? 'success' : 'danger';
            const statusIcon = device.status === 'connected' ? 'check-circle-fill' : 'x-circle-fill';
            const lastItem = index === devices.length - 1 ? 'border-bottom-0' : '';
            
            const deviceHtml = `
                <div class="list-group-item list-group-item-action border-start-0 border-end-0 py-3 ${lastItem}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center mb-2">
                                <i class="bi bi-phone me-2 text-muted"></i>
                                <h6 class="mb-0 fw-semibold text-dark">${device.name}</h6>
                            </div>
                            <div class="d-flex align-items-center">
                                <span class="badge bg-${statusColor} me-3 px-2 py-1 rounded-pill">
                                    <i class="bi bi-${statusIcon} me-1"></i>
                                    ${device.status.charAt(0).toUpperCase() + device.status.slice(1)}
                                </span>
                                <small class="text-muted">
                                    <i class="bi bi-clock me-1"></i>
                                    Last active: ${device.lastActive}
                                </small>
                            </div>
                        </div>
                        <div class="d-flex gap-2 ms-3">
                            <button class="btn btn-sm btn-outline-primary rounded-pill px-3 btn-test" 
                                    data-id="${device.id}" 
                                    title="Send Test Message"
                                <i class="bi bi-send me-1"></i>
                                Test
                            </button>
                            <button class="btn btn-sm btn-outline-danger rounded-pill px-3 btn-delete" 
                                    data-id="${device.id}" 
                                    title="Delete Device"
                                <i class="bi bi-trash me-1"></i>
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            `;
            devicesListContainer.insertAdjacentHTML('beforeend', deviceHtml);
        });
    }



}

function setupEventListeners() {

    const sendTestMessageBtn = document.getElementById('send-test-message-btn');
    if (sendTestMessageBtn) {
        sendTestMessageBtn.addEventListener('click', handleSendTestMessage);
    }

    const devicesListContainer = document.getElementById('devicesListContainer');
    if (devicesListContainer) {
        devicesListContainer.addEventListener('click', handleListActions);
    }

    const pairDeviceModalCancelBtn = document.getElementById('pairDeviceModalCancelBtn');
    if (pairDeviceModalCancelBtn) {

        const startPairingBtn = document.getElementById('start-pairing-btn');
        const pairingBtnText = document.getElementById('pairing-btn-text');
        const pairingInitialState = document.getElementById('pairing-initial-state');
        const pairingActiveState = document.getElementById('pairing-active-state');

        pairDeviceModalCancelBtn.addEventListener('click', () => {
            // Reset modal
        startPairingBtn.disabled = false;
        pairingBtnText.textContent = 'Start Pairing';
        startPairingBtn.querySelector('.spinner-border').classList.add('d-none');
        pairingInitialState.classList.remove('d-none');
        pairingActiveState.classList.add('d-none');
        });
    }
}

async function intializeSocket() {

    // 1. This line initiates the connection as soon as the page loads
    const socket = io();

    // --- Socket Event Listeners ---

    socket.on('connect', () => {
        console.log('Successfully connected to the server!');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from the server.');
    });

    // Listen for the QR code update from the server
    socket.on('qr-code-update', (data) => {
        console.log('New QR code received from server.');
        
        qrCodeContainer.textContent = `QR Code Data Received: ${data.qr.substring(0, 30)}...`;
    });

    

    // --- DOM Event Listeners ---
    const startPairingBtn = document.getElementById('start-pairing-btn');
    if (startPairingBtn) {
        startPairingBtn.addEventListener('click', () => {
            socket.emit('request-new-qr');
            handlePairDevice();
        });
    }

    if (connectButton) {
        connectButton.addEventListener('click', () => {
            console.log('Requesting a new QR code from the server...');
            qrCodeContainer.style.display = 'block';
            qrCodeContainer.textContent = 'Generating QR Code...';
            
            // 2. Tell the server we are ready for a new QR code
            socket.emit('request-new-qr');
        });
    }
}


async function handlePairDevice () {
    console.log('fuck me');
    if (devices.length >= 4) {
        showAlert('Maximum number of devices (4) reached. Please remove a device first.', 'danger');
        return;
    }

    const pairDeviceModal = bootstrap.Modal.getInstance(document.getElementById('pairDeviceModal'));
    const startPairingBtn = document.getElementById('start-pairing-btn');
    const pairingBtnText = document.getElementById('pairing-btn-text');
    const pairingInitialState = document.getElementById('pairing-initial-state');
    const pairingActiveState = document.getElementById('pairing-active-state');

    startPairingBtn.disabled = true;
    pairingBtnText.textContent = 'Pairing...';
    startPairingBtn.querySelector('.spinner-border').classList.remove('d-none');

    pairingInitialState.classList.add('d-none');
    pairingActiveState.classList.remove('d-none');
        
    // Simulate pairing process
    // setTimeout(() => {
    //     const newDevice = {
    //         id: Date.now(),
    //         name: `Device ${devices.length + 1}`,
    //         status: 'connected',
    //         lastActive: new Date().toLocaleString()
    //     };
    //     devices.push(newDevice);
    //     renderDevices();

    //     // Reset modal
    //     startPairingBtn.disabled = false;
    //     pairingBtnText.textContent = 'Start Pairing';
    //     startPairingBtn.querySelector('.spinner-border').classList.add('d-none');
    //     pairingInitialState.classList.remove('d-none');
    //     pairingActiveState.classList.add('d-none');

    //     pairDeviceModal.hide();
    //     showAlert('Device paired successfully!');
    // }, 3000);
}


// -- HELPER FUNCTIONS --
const showAlert = (message, severity = 'success') => {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        console.error('Alert container not found');
        return;
    }

    const alertHtml = `
        <div class="alert alert-${severity} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    alertContainer.innerHTML = alertHtml;
};
