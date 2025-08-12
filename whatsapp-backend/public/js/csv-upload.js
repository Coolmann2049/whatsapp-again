

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & DATA ---
    let uploadHistory = [];
    let manualContacts = [];

    // --- DOM REFERENCES ---
    const fileListBody = document.getElementById('file-list-body');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-upload-input');
    
    // New Manual Entry DOM refs
    const manualContactForm = document.getElementById('manual-contact-form');
    const manualContactsBody = document.getElementById('manual-contacts-body');
    const manualPhoneInput = document.getElementById('manual-phone');
    const manualNameInput = document.getElementById('manual-name');
    const manualCompanyInput = document.getElementById('manual-company');

    // --- HELPER FUNCTIONS ---
    const getStatusBadge = (status) => {
        const colors = { completed: 'success', processing: 'warning', failed: 'danger' };
        return `<span class="badge bg-${colors[(status || '').toLowerCase()] || 'secondary'}">${status}</span>`;
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
    const uploadFile = async (fileToUpload) => {
        // Create a temporary entry for immediate UI feedback
        const tempId = Date.now();
        const newFileEntry = {
            id: tempId,
            file_name: fileToUpload.name,
            status: 'Processing',
            total_contacts: '...',
            upload_date: new Date().toISOString(),
        };
        files.unshift(newFileEntry);
        renderFiles();

        const formData = new FormData();
        formData.append('csvFile', fileToUpload);

        try {
            const response = await fetch('/api/csv/upload-contacts', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Upload failed');
            }
            
            // After a successful upload, fetch the entire history again to get the real, updated data
            fetchUploadHistory();

        } catch (error) {
            console.error('Upload error:', error);
            // Find the temp entry and mark it as failed
            const errorFileEntry = files.find(f => f.id === tempId);
            if (errorFileEntry) {
                errorFileEntry.status = 'Failed';
                errorFileEntry.total_contacts = 0;
            }
            alert(`Error: ${error.message}`);
            renderFiles();
        }
    };
    
    // --- Function to fetch initial data ---
    const fetchUploadHistory = async () => {
        try {
            const response = await fetch('/api/csv/upload-history');
            if (!response.ok) {
                throw new Error('Could not fetch upload history.');
            }
            const data = await response.json();
            files = data;
            renderFiles();
        } catch (error) {
            console.error(error);
            fileListBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error loading history.</td></tr>`;
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
            await fetchUploadHistory(); // Refresh both lists
        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        }
    };

    const deleteContact = async (contactId) => {
        if (!confirm('Are you sure you want to delete this contact?')) return;
        try {
            const response = await fetch(`/api/data/contacts/${contactId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete contact');
            await fetchUploadHistory();
        } catch (error) {
            console.error(error);
            alert('Error deleting contact.');
        }
    };
    
    const handleFileSelect = (uploadedFile) => {
            if (!uploadedFile) return;
            if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
                alert('Please upload a valid .csv file.');
                return;
            }
            uploadFile(uploadedFile);
        };

    const handleTableActions = async (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const fileId = parseInt(target.dataset.id);

        if (target.classList.contains('btn-delete')) {
            // Find the file name to use in the confirmation message
            const fileToDelete = files.find(f => f.id === fileId);
            const fileName = fileToDelete ? fileToDelete.file_name : 'this file';

            if (confirm(`Are you sure you want to delete "${fileName}" and all its associated contacts? This action cannot be undone.`)) {
                try {
                    // Disable the button to prevent multiple clicks
                    target.disabled = true;

                    // 1. Make the API call to the backend
                    const response = await fetch(`/api/csv/upload-history/${fileId}`, {
                        method: 'DELETE'
                    });

                    // 2. Check if the server responded with an error
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Server error');
                    }

                    // 3. Only if the API call is successful, update the frontend
                    files = files.filter(f => f.id !== fileId);
                    renderFiles();
                    alert('Upload record and associated contacts deleted successfully!');

                } catch (error) {
                    console.error('Failed to delete upload record:', error);
                    alert(`Error: ${error.message}`);
                    // Re-enable the button if the action failed
                    target.disabled = false;
                }
            }
        }
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
    fileListBody.addEventListener('click', handleTableActions);
    manualContactForm.addEventListener('submit', addManualContact);
    manualContactsBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-contact');
        if (deleteBtn) {
            deleteContact(deleteBtn.dataset.id);
        }
    });
    // --- INITIAL FETCH ---
    fetchUploadHistory();
});