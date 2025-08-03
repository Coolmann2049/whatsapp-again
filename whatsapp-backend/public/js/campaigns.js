document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allData = { campaigns: [], templates: [], devices: [], contactFiles: [] };
    let editingCampaignId = null;
    let selectedContactFileIds = [];

    // --- DOM REFERENCES ---
    const campaignForm = document.getElementById('campaign-form');
    const formTitle = document.getElementById('form-title');
    const campaignNameInput = document.getElementById('campaign-name');
    const templateSelect = document.getElementById('message-template');
    const deviceSelect = document.getElementById('device-list');
    const saveCampaignBtn = document.getElementById('save-campaign-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const campaignsTableBody = document.getElementById('campaigns-table-body');
    const contactFilesList = document.getElementById('contact-files-list');
    const saveContactsSelectionBtn = document.getElementById('save-contacts-selection-btn');
    const selectedFilesDisplay = document.getElementById('selected-files-display');
    const contactsModal = new bootstrap.Modal(document.getElementById('contactsModal'));

    // --- RENDER FUNCTIONS ---
    const renderCampaignsTable = () => {
        campaignsTableBody.innerHTML = '';
        if (allData.campaigns.length === 0) {
            campaignsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No campaigns created yet.</td></tr>`;
            return;
        }
        allData.campaigns.forEach(campaign => {
            const statusColors = { Draft: 'secondary', Running: 'primary', Paused: 'warning', Completed: 'success' };
            const actionButtons = campaign.status === 'Running' ?
                `<button class="btn btn-sm btn-outline-warning btn-pause" data-id="${campaign.id}">Pause</button>` :
                `<button class="btn btn-sm btn-outline-success btn-start" data-id="${campaign.id}">Start</button>`;

            const rowHtml = `
                <tr>
                    <td>${campaign.name}</td>
                    <td>${campaign.device?.name || 'N/A'}</td>
                    <td>${campaign.template?.name || 'N/A'}</td>
                    <td><span class="badge bg-${statusColors[campaign.status] || 'light'}">${campaign.status}</span></td>
                    <td class="text-end">
                        ${actionButtons}
                        <button class="btn btn-sm btn-outline-secondary btn-edit ms-1" data-id="${campaign.id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger btn-delete ms-1" data-id="${campaign.id}">Delete</button>
                    </td>
                </tr>
            `;
            campaignsTableBody.insertAdjacentHTML('beforeend', rowHtml);
        });
    };

    const populateDropdowns = () => {
        templateSelect.innerHTML = '<option value="" disabled selected>Select a template...</option>';
        allData.templates.forEach(t => templateSelect.add(new Option(t.name, t.id)));

        deviceSelect.innerHTML = '<option value="" disabled selected>Select a device...</option>';
        allData.devices.forEach(d => deviceSelect.add(new Option(d.name, d.id)));
    };

    const renderContactFilesModal = () => {
        contactFilesList.innerHTML = '';
        if (allData.contactFiles.length === 0) {
            contactFilesList.innerHTML = '<p class="text-muted text-center">No contact files have been uploaded yet.</p>';
            return;
        }
        allData.contactFiles.forEach(file => {
            const isChecked = selectedContactFileIds.includes(file.id);
            const fileHtml = `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${file.id}" id="file-${file.id}" ${isChecked ? 'checked' : ''}>
                    <label class="form-check-label" for="file-${file.id}">
                        ${file.file_name} <span class="text-muted">(${file.total_contacts} contacts)</span>
                    </label>
                </div>
            `;
            contactFilesList.insertAdjacentHTML('beforeend', fileHtml);
        });
    };

    // --- API & DATA HANDLING ---
    const fetchData = async () => {
        try {
            const response = await fetch('/api/data/campaign-creation-data');
            if (!response.ok) throw new Error('Failed to fetch initial data');
            const result = await response.json();
            allData = {
                campaigns: result.data.campaigns,
                templates: result.data.templates,
                devices: result.data.devices,
                contactFiles: result.data.contacts // This is the UploadHistory
            };
            renderCampaignsTable();
            populateDropdowns();
        } catch (error) {
            console.error(error);
            alert('Could not load page data. Please refresh.');
        }
    };

    // --- FORM & ACTION HANDLERS ---
    const resetForm = () => {
        campaignForm.reset();
        editingCampaignId = null;
        selectedContactFileIds = [];
        formTitle.innerHTML = '<i class="bi bi-plus-lg me-2"></i>Create New Campaign';
        saveCampaignBtn.textContent = 'Save Campaign';
        cancelEditBtn.classList.add('d-none');
        updateSelectedFilesDisplay();
    };

    const populateFormForEdit = (campaignId) => {
        const campaign = allData.campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        editingCampaignId = campaign.id;
        campaignNameInput.value = campaign.name;
        templateSelect.value = campaign.template_id;
        deviceSelect.value = campaign.deviceId;
        // Note: We don't know the selected contacts for an existing campaign, this would require another API call
        selectedContactFileIds = []; 
        updateSelectedFilesDisplay();

        formTitle.innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Campaign';
        saveCampaignBtn.textContent = 'Update Campaign';
        cancelEditBtn.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const updateSelectedFilesDisplay = () => {
        const count = selectedContactFileIds.length;
        if (count === 0) {
            selectedFilesDisplay.textContent = 'None';
        } else {
            selectedFilesDisplay.textContent = `${count} file(s) selected`;
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        // 1. Get the selected device ID from the dropdown
        const selectedDeviceId = deviceSelect.value;

        // 2. Find the full device object from our stored data
        const selectedDevice = allData.devices.find(d => d.id == selectedDeviceId);
        // 3. Check if a device was found and get its clientId
        if (!selectedDevice) {
            alert('Please select a valid device.');
            return;
        }


        const clientId = selectedDevice.clientId;

        // 4. Construct the campaign data, now including the clientId
        const campaignData = {
            name: campaignNameInput.value,
            template_id: templateSelect.value,
            deviceId: selectedDeviceId,
            contactFileIds: selectedContactFileIds,
            clientId: clientId // <-- ADD THIS LINE
        };

        console.log(campaignData);
        const isUpdating = !!editingCampaignId;
        const url = isUpdating ? `/api/data/campaigns/${editingCampaignId}` : '/api/data/campaigns';
        const method = isUpdating ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(campaignData)
            });
            if (!response.ok) throw new Error('Failed to save campaign');
            
            resetForm();
            await fetchData(); // Refresh all data
        } catch (error) {
            console.error(error);
            alert('Error saving campaign.');
        }
    };
const handleTableActions = async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const campaignId = parseInt(target.dataset.id);
    if (!campaignId) return;

    // --- Find the button that was clicked and perform the correct action ---

    if (target.classList.contains('btn-edit')) {
        populateFormForEdit(campaignId);
        return; // Exit after handling edit
    }

    let url = '';
    let method = '';
    let confirmMessage = '';
    let successMessage = '';

    if (target.classList.contains('btn-delete')) {
        confirmMessage = 'Are you sure you want to delete this campaign? This action cannot be undone.';
        url = `/api/data/campaigns/${campaignId}`;
        method = 'DELETE';
        successMessage = 'Campaign deleted successfully.';
    } else if (target.classList.contains('btn-start')) {
        confirmMessage = 'Are you sure you want to start this campaign?';
        url = `/api/whatsapp/campaigns/${campaignId}/start`;
        method = 'POST';
        successMessage = 'Campaign has been started.';
    } else if (target.classList.contains('btn-pause')) {
        confirmMessage = 'Are you sure you want to pause this campaign?';
        url = `/api/data/campaigns/${campaignId}/pause`;
        method = 'PUT'; // PUT is more appropriate for updating state to 'paused'
        successMessage = 'Campaign has been paused.';
    }

    if (!url) return; // If no action button was matched, do nothing

    // --- Perform the API call ---

    if (confirm(confirmMessage)) {
        try {
            // Disable the button to prevent multiple clicks
            target.disabled = true;

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to perform action.`);
            }

            // If successful, show a confirmation and refresh the data
            alert(successMessage);
            await fetchData();

        } catch (error) {
            console.error(`Error during campaign action (${method}):`, error);
            alert(`Error: ${error.message}`);
            // Re-enable the button if the action failed
            target.disabled = false;
        }
    }
};

    // --- ATTACH EVENT LISTENERS ---
    campaignForm.addEventListener('submit', handleFormSubmit);
    cancelEditBtn.addEventListener('click', resetForm);
    campaignsTableBody.addEventListener('click', handleTableActions);
    
    document.getElementById('contactsModal').addEventListener('show.bs.modal', renderContactFilesModal);

    saveContactsSelectionBtn.addEventListener('click', () => {
        selectedContactFileIds = Array.from(contactFilesList.querySelectorAll('input:checked')).map(input => parseInt(input.value));
        updateSelectedFilesDisplay();
        contactsModal.hide();
    });

    // --- INITIALIZATION ---
    fetchData();
});