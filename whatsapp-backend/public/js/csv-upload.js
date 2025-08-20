document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & DATA ---
    let uploadHistory = [];
    let manualContacts = [];
    let availableDevices = [];
    let availableGroups = [];
    let selectedDeviceId = null;

    // --- DOM REFERENCES ---
    const fileListBody = document.getElementById('file-list-body');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-upload-input');
    
    // Manual Entry DOM refs
    const manualContactForm = document.getElementById('manual-contact-form');
    const manualContactsBody = document.getElementById('manual-contacts-body');
    const manualPhoneInput = document.getElementById('manual-phone');
    const manualNameInput = document.getElementById('manual-name');
    const manualCompanyInput = document.getElementById('manual-company');
    
    // Group Import DOM refs
    const groupImportModal = document.getElementById('groupImportModal');
    const deviceSelectionStep = document.getElementById('device-selection-step');
    const groupSelectionStep = document.getElementById('group-selection-step');
    const importProgressStep = document.getElementById('import-progress-step');
    const deviceList = document.getElementById('device-list');
    const groupList = document.getElementById('group-list');
    const deviceLoading = document.getElementById('device-loading');
    const groupLoading = document.getElementById('group-loading');
    const backToDevicesBtn = document.getElementById('back-to-devices');
    const importSelectedGroupsBtn = document.getElementById('import-selected-groups');
    const selectAllGroupsBtn = document.getElementById('select-all-groups');
    const deselectAllGroupsBtn = document.getElementById('deselect-all-groups');
    const importProgressBar = document.getElementById('import-progress-bar');
    const importStatus = document.getElementById('import-status');

    // --- HELPER FUNCTIONS ---
    const getStatusBadge = (status) => {
        const colors = { completed: 'success', processing: 'warning', failed: 'danger' };
        const sanitizedStatus = (status || 'unknown').toLowerCase();
        return `<span class="badge bg-${colors[sanitizedStatus] || 'secondary'}">${status}</span>`;
    };

    // --- RENDER FUNCTIONS ---
    const renderUploadHistory = () => {
        fileListBody.innerHTML = '';
        const csvFiles = uploadHistory.filter(f => f.file_name !== 'Manually Added Contacts');
        if (csvFiles.length === 0) {
            fileListBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No CSV files uploaded yet.</td></tr>`;
            return;
        }
        csvFiles.forEach(file => {
            const rowHtml = `
                <tr>
                    <td>${file.file_name}</td>
                    <td>${new Date(file.upload_date || file.createdAt).toLocaleDateString()}</td>
                    <td>${getStatusBadge(file.status)}</td>
                    <td>${file.total_contacts}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger btn-delete-history" data-id="${file.id}" title="Delete History"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
            fileListBody.insertAdjacentHTML('beforeend', rowHtml);
        });
    };

    const renderManualContacts = () => {
        manualContactsBody.innerHTML = '';
        if (manualContacts.length === 0) {
            manualContactsBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No contacts added manually.</td></tr>`;
            return;
        }
        manualContacts.forEach(contact => {
            const rowHtml = `
                <tr>
                    <td>${contact.phone}</td>
                    <td>${contact.name}</td>
                    <td>${contact.company}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger btn-delete-contact" data-id="${contact.id}" title="Delete Contact"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
            manualContactsBody.insertAdjacentHTML('beforeend', rowHtml);
        });
    };

    // --- API & DATA HANDLING ---
    const fetchInitialData = async () => {
        try {
            const [historyRes, manualContactsRes] = await Promise.all([
                fetch('/api/csv/upload-history'),
                fetch('/api/data/contacts/manual')
            ]);
            if (!historyRes.ok || !manualContactsRes.ok) throw new Error('Failed to fetch initial data.');
            
            uploadHistory = await historyRes.json();
            manualContacts = await manualContactsRes.json();
            
            renderUploadHistory();
            renderManualContacts();
        } catch (error) {
            console.error(error);
            alert('Could not load page data. Please refresh.');
        }
    };

    const uploadFile = async (fileToUpload) => {
        const tempId = Date.now();
        const newFileEntry = {
            id: tempId,
            file_name: fileToUpload.name,
            status: 'Processing',
            total_contacts: '...',
            upload_date: new Date().toISOString(),
        };
        uploadHistory.unshift(newFileEntry);
        renderUploadHistory();

        const formData = new FormData();
        formData.append('csvFile', fileToUpload);

        try {
            const response = await fetch('/api/csv/upload-contacts', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Upload failed');
            
            await fetchInitialData(); // Refresh all data from server
        } catch (error) {
            console.error('Upload error:', error);
            const errorFileEntry = uploadHistory.find(f => f.id === tempId);
            if (errorFileEntry) {
                errorFileEntry.status = 'Failed';
                errorFileEntry.total_contacts = 0;
            }
            alert(`Error: ${error.message}`);
            renderUploadHistory();
        }
    };

    const addManualContact = async (e) => {
        e.preventDefault();
        const phone = manualPhoneInput.value;
        const name = manualNameInput.value;
        const company = manualCompanyInput.value;

        if (!phone) {
            alert('Phone number is required.');
            return;
        }

        const addButton = e.target.querySelector('button[type="submit"]');
        addButton.disabled = true;

        try {
            const response = await fetch('/api/data/contacts/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, name, company })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error);
            }
            manualContactForm.reset();
            await fetchInitialData();
        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        } finally {
            addButton.disabled = false;
        }
    };

    const deleteManualContact = async (contactId) => {
        if (!confirm('Are you sure you want to delete this contact?')) return;
        try {
            const response = await fetch(`/api/data/contacts/${contactId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete contact');
            await fetchInitialData();
        } catch (error) {
            console.error(error);
            alert('Error deleting contact.');
        }
    };
    
    const deleteHistoryRecord = async (historyId) => {
        const fileToDelete = uploadHistory.find(f => f.id === historyId);
        const fileName = fileToDelete ? fileToDelete.file_name : 'this file';

        if (!confirm(`Are you sure you want to delete "${fileName}" and all its associated contacts? This action cannot be undone.`)) return;
        
        try {
            const response = await fetch(`/api/csv/upload-history/${historyId}`, { method: 'DELETE' });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Server error');
            }
            await fetchInitialData();
            alert('Upload record and associated contacts deleted successfully!');
        } catch (error) {
            console.error('Failed to delete upload record:', error);
            alert(`Error: ${error.message}`);
        }
    };

    // --- GROUP IMPORT FUNCTIONS ---
    const fetchUserDevices = async () => {
        try {
            const response = await fetch('/api/user/devices');
            if (!response.ok) throw new Error('Failed to fetch devices');
            const data = await response.json();
            availableDevices = data.devices || [];
            return availableDevices;
        } catch (error) {
            console.error('Error fetching devices:', error);
            throw error;
        }
    };

    const fetchGroupsForDevice = async (deviceId) => {
        try {
            const response = await fetch(`/api/data/groups/${deviceId}`);
            if (!response.ok) throw new Error('Failed to fetch groups');
            const data = await response.json();
            availableGroups = data.groups || [];
            return availableGroups;
        } catch (error) {
            console.error('Error fetching groups:', error);
            throw error;
        }
    };

    const importGroupContacts = async (selectedGroups) => {
        try {
            const response = await fetch('/api/data/import-group-contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: selectedDeviceId,
                    groups: selectedGroups
                })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Import failed');
            }
            return await response.json();
        } catch (error) {
            console.error('Error importing contacts:', error);
            throw error;
        }
    };

    const renderDeviceList = (devices) => {
        deviceList.innerHTML = '';
        if (devices.length === 0) {
            deviceList.innerHTML = '<div class="text-center text-muted py-4">No connected devices found. Please connect a device first.</div>';
            return;
        }
        devices.forEach(device => {
            const deviceHtml = `
                <div class="list-group-item list-group-item-action device-item" data-device-id="${device.clientId}">
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${device.name || 'Unnamed Device'}</h6>
                            <p class="mb-1 text-muted small">Client ID: ${device.clientId}</p>
                            <small class="text-success"><i class="bi bi-check-circle-fill"></i> Connected</small>
                        </div>
                        <i class="bi bi-chevron-right"></i>
                    </div>
                </div>
            `;
            deviceList.insertAdjacentHTML('beforeend', deviceHtml);
        });
    };

    const renderGroupList = (groups) => {
        groupList.innerHTML = '';
        if (groups.length === 0) {
            groupList.innerHTML = '<div class="text-center text-muted py-4">No groups found for this device.</div>';
            return;
        }
        groups.forEach(group => {
            const groupHtml = `
                <div class="list-group-item">
                    <div class="form-check">
                        <input class="form-check-input group-checkbox" type="checkbox" value="${group.id}" id="group-${group.id}">
                        <label class="form-check-label w-100" for="group-${group.id}">
                            <div class="d-flex w-100 justify-content-between">
                                <div>
                                    <h6 class="mb-1">${group.name}</h6>
                                    <p class="mb-1 text-muted small">${group.participants || 0} participants</p>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            `;
            groupList.insertAdjacentHTML('beforeend', groupHtml);
        });
    };

    const showStep = (stepElement) => {
        [deviceSelectionStep, groupSelectionStep, importProgressStep].forEach(step => {
            step.style.display = 'none';
        });
        stepElement.style.display = 'block';
        
        // Update modal footer buttons
        backToDevicesBtn.style.display = stepElement === groupSelectionStep ? 'inline-block' : 'none';
        importSelectedGroupsBtn.style.display = stepElement === groupSelectionStep ? 'inline-block' : 'none';
    };

    const updateImportButtonState = () => {
        const selectedGroups = document.querySelectorAll('.group-checkbox:checked');
        importSelectedGroupsBtn.disabled = selectedGroups.length === 0;
    };

    // --- EVENT HANDLERS ---
    const handleFileSelect = (uploadedFile) => {
        if (!uploadedFile) return;
        if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
            alert('Please upload a valid .csv file.');
            return;
        }
        uploadFile(uploadedFile);
    };
    
    // --- DRAG & DROP ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // --- ATTACH EVENT LISTENERS ---
    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    manualContactForm.addEventListener('submit', addManualContact);

    fileListBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-history');
        if (deleteBtn) {
            deleteHistoryRecord(parseInt(deleteBtn.dataset.id));
        }
    });

    manualContactsBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-contact');
        if (deleteBtn) {
            deleteManualContact(parseInt(deleteBtn.dataset.id));
        }
    });

    // --- GROUP IMPORT EVENT LISTENERS ---
    groupImportModal.addEventListener('show.bs.modal', async () => {
        showStep(deviceSelectionStep);
        deviceLoading.style.display = 'block';
        try {
            const devices = await fetchUserDevices();
            renderDeviceList(devices);
        } catch (error) {
            deviceList.innerHTML = '<div class="text-center text-danger py-4">Error loading devices. Please try again.</div>';
        } finally {
            deviceLoading.style.display = 'none';
        }
    });

    deviceList.addEventListener('click', async (e) => {
        const deviceItem = e.target.closest('.device-item');
        if (!deviceItem) return;
        
        selectedDeviceId = deviceItem.dataset.deviceId;
        showStep(groupSelectionStep);
        groupLoading.style.display = 'block';
        
        try {
            const groups = await fetchGroupsForDevice(selectedDeviceId);
            renderGroupList(groups);
        } catch (error) {
            groupList.innerHTML = '<div class="text-center text-danger py-4">Error loading groups. Please try again.</div>';
        } finally {
            groupLoading.style.display = 'none';
        }
    });

    groupList.addEventListener('change', (e) => {
        if (e.target.classList.contains('group-checkbox')) {
            updateImportButtonState();
        }
    });

    selectAllGroupsBtn.addEventListener('click', () => {
        document.querySelectorAll('.group-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
        updateImportButtonState();
    });

    deselectAllGroupsBtn.addEventListener('click', () => {
        document.querySelectorAll('.group-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        updateImportButtonState();
    });

    backToDevicesBtn.addEventListener('click', () => {
        showStep(deviceSelectionStep);
    });

    importSelectedGroupsBtn.addEventListener('click', async () => {
        const selectedGroups = Array.from(document.querySelectorAll('.group-checkbox:checked'))
            .map(checkbox => {
                const groupId = checkbox.value;
                const group = availableGroups.find(g => g.id === groupId);
                return { id: groupId, name: group ? group.name : 'Unknown Group' };
            });
        
        if (selectedGroups.length === 0) return;
        
        showStep(importProgressStep);
        importProgressBar.style.width = '0%';
        
        try {
            // Simulate progress
            importProgressBar.style.width = '30%';
            
            const result = await importGroupContacts(selectedGroups);
            
            importProgressBar.style.width = '100%';
            importStatus.innerHTML = `
                <div class="text-success">
                    <i class="bi bi-check-circle-fill fs-1"></i>
                    <p class="mt-2 mb-0">Successfully imported ${result.totalContacts} contacts from ${selectedGroups.length} group(s)!</p>
                </div>
            `;
            
            // Refresh upload history to show new imports
            setTimeout(async () => {
                await fetchInitialData();
                bootstrap.Modal.getInstance(groupImportModal).hide();
            }, 2000);
            
        } catch (error) {
            importProgressBar.style.width = '100%';
            importProgressBar.classList.add('bg-danger');
            importStatus.innerHTML = `
                <div class="text-danger">
                    <i class="bi bi-exclamation-circle-fill fs-1"></i>
                    <p class="mt-2 mb-0">Import failed: ${error.message}</p>
                    <button class="btn btn-outline-primary btn-sm mt-2" onclick="location.reload()">Try Again</button>
                </div>
            `;
        }
    });

    // --- INITIAL FETCH ---
    fetchInitialData();
});