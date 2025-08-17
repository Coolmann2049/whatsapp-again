let devices = [];
let selectedDevice = null;

document.addEventListener('DOMContentLoaded', () => {

    intializeSocket();

    setupEventListeners();

    initializeData();

    renderDevices();
});


function handleSendTestMessage  () {
    const testMessageModal = bootstrap.Modal.getInstance(document.getElementById('testMessageModal'));
    const testNumberInput = document.getElementById('test-number');
    const testMessageInput = document.getElementById('test-message');

    const number = testNumberInput.value.trim();
    const message = testMessageInput.value.trim();
    
    if (!number || !message) {
        showAlert('Please fill in all fields to send a test message.', 'danger');
        return;
    }

    console.log(`Sending to ${number}: "${message}" from device ID ${selectedDevice.id}`);
    sendTestMessage(selectedDevice.id, number, message).then(() => {
        showAlert('Test message sent successfully!');
        testMessageModal.hide();
        testNumberInput.value = '';
        testMessageInput.value = '';

        selectedDevice=null;
    }).catch((error) => {
        showAlert(error.message, 'danger');
    });
}

async function sendTestMessage(deviceId, number, message) {
    // The endpoint path includes the deviceId as a URL parameter
    const apiUrl = `/api/whatsapp/send-test-message/${deviceId}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // The number and message are sent in the body
        body: JSON.stringify({ number, message }),
    });

    // Check if the server responded with an error
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send message.');
    }

    // Return the successful response data
    return response.json();
}

const handleListActions = async (e) => {

    
    const testMessageModalElement = document.getElementById('testMessageModal');
    const testMessageModal = bootstrap.Modal.getInstance(testMessageModalElement);

    const target = e.target.closest('button');
    if (!target) return;
    
    // It's good practice to get the ID as a string and use it as such
    const deviceId = target.dataset.id;
    if (target.classList.contains('btn-delete')) {
        // Find the device object *before* deleting, to use its name in alerts
        const deviceToDelete = devices.find(d => d.id == deviceId);
        if (!deviceToDelete) return;
        console.log(deviceToDelete);
        if (confirm(`Are you sure you want to remove "${deviceToDelete.name}"?`)) {
            try {
                // 1. Make the API call to the backend first
                const response = await fetch(`/api/whatsapp/delete-device/${deviceId}`, {
                    method: 'DELETE',
                });

                // 2. Check if the server responded with an error
                if (!response.ok) {
                    // If the server returns an error, show it and stop
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Server error');
                }

                // 3. Only if the API call is successful, update the frontend
                devices = devices.filter(d => d.id != deviceId);
                renderDevices();
                showAlert('Device removed successfully!');

            } catch (error) {
                console.error('Failed to delete device:', error);
                showAlert(`Error: ${error.message}`, 'danger');
            }
        }
    } else if (target.classList.contains('btn-test')) {
        selectedDevice = devices.find(d => d.id == deviceId);
        // Add a check to ensure the device was found
        if (selectedDevice) {
            // You might want to populate the modal with the device name here
            testMessageModal.show();
        }
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
                                    <i class="bi bi-telephone me-1"></i>
                                    Phone Number: ${device.phone}
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

async function initializeData() {

    const testMessageModalEl = document.getElementById('testMessageModal');
    const testMessageModal = new bootstrap.Modal(testMessageModalEl);
    const response = await fetch('/api/user/devices');
    if (!response.ok) {
        throw new Error('Failed to fetch devices');
    }
    let devicesData = await response.json();
    devices = devicesData.devices;
    renderDevices();
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

    socket.on('device-data', (data) => {
        console.log(data);
        devices = data;
        renderDevices();
    });

    // Listen for the QR code update from the server
    socket.on('qr-code-initialized', (data) => {
        console.log('New QR code received from server.');
        const qrCodeStatus = document.getElementById('qr-code-status');
        if (qrCodeStatus) {
            qrCodeStatus.textContent = 'Fetching new QR code';
        }
    });

    socket.on('qr-code-update', (data) => 
        {
        console.log('New QR code received from server.');
        const qrCodeStatus = document.getElementById('qr-code-status');
        if (qrCodeStatus) {
            qrCodeStatus.textContent = 'Waiting for device connection...';
        }

        const qrCodePlaceholder = document.getElementById('qrCodePlaceholder');
        qrCodePlaceholder.classList.remove('qr-code-placeholder');
        qrCodePlaceholder.innerHTML = '';
        // Generate the new QR code from the data string
        new QRCode(qrCodePlaceholder, {
            text: data.qrCode,
            width: 256,
            height: 256,
        });
    });

    socket.on('qr-code-initialized', (data) => {
        console.log('Fetching new QR code.');
        const qrCodeStatus = document.getElementById('qr-code-status');
        if (qrCodeStatus) {
            qrCodeStatus.textContent = 'Fetching new QR code';
        }
    });

    socket.on('device-update', (data) => {
        console.log('Recieved new device details after logging in.');

        initializeData();
        renderDevices();

        //Reset the modal
        const pairingBtnText = document.getElementById('pairing-btn-text');
        const pairingInitialState = document.getElementById('pairing-initial-state');
        const pairingActiveState = document.getElementById('pairing-active-state');
        const pairDeviceModal = bootstrap.Modal.getInstance(document.getElementById('pairDeviceModal'));

        startPairingBtn.disabled = false;
        pairingBtnText.textContent = 'Start Pairing';
        startPairingBtn.querySelector('.spinner-border').classList.add('d-none');
        pairingInitialState.classList.remove('d-none');
        pairingActiveState.classList.add('d-none');

        pairDeviceModal.hide();
        showAlert('Device paired successfully!');
    });

    

    // --- DOM Event Listeners ---
    const startPairingBtn = document.getElementById('start-pairing-btn');
    if (startPairingBtn) {
        startPairingBtn.addEventListener('click', () => {

            if (devices.length >= 4) {
                showAlert('Maximum number of devices (4) reached. Please remove a device first.', 'danger');
                return;
            }

            socket.emit('request-new-qr');
            handlePairDevice();
        });
    }

}


async function handlePairDevice () {
    if (devices.length >= 4) {
        showAlert('Maximum number of devices (4) reached. Please remove a device first.', 'danger');
        return;
    }

    const startPairingBtn = document.getElementById('start-pairing-btn');
    const pairingBtnText = document.getElementById('pairing-btn-text');
    const pairingInitialState = document.getElementById('pairing-initial-state');
    const pairingActiveState = document.getElementById('pairing-active-state');

    startPairingBtn.disabled = true;
    pairingBtnText.textContent = 'Pairing...';
    startPairingBtn.querySelector('.spinner-border').classList.remove('d-none');

    pairingInitialState.classList.add('d-none');
    pairingActiveState.classList.remove('d-none');
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
