document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & DATA ---
    let files = []; // This will be populated from the server

    // --- DOM REFERENCES ---
    const fileListBody = document.getElementById('file-list-body');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-upload-input');

    // --- HELPER FUNCTIONS ---
    const getStatusBadge = (status) => {
        const colors = {
            completed: 'success',
            processing: 'warning',
            failed: 'danger'
        };
        const sanitizedStatus = (status || 'unknown').toLowerCase();
        return `<span class="badge bg-${colors[sanitizedStatus] || 'secondary'}">${status}</span>`;
    };

    // --- RENDER FUNCTION (Updated) ---
    const renderFiles = () => {
        fileListBody.innerHTML = ''; // Clear table
        if (files.length === 0) {
            fileListBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No upload history found.</td></tr>`;
            return;
        }

        files.forEach(file => {
            const rowHtml = `
                <tr>
                    <td>${file.file_name || 'N/A'}</td>
                    <td>${new Date(file.upload_date || Date.now()).toLocaleDateString()}</td>
                    <td>${getStatusBadge(file.status)}</td>
                    <td>${file.total_contacts || 0}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${file.id}" title="Delete History"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
            fileListBody.insertAdjacentHTML('beforeend', rowHtml);
        });
    };

    // --- API & UPLOAD LOGIC ---
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

    // --- EVENT HANDLERS ---
    const handleFileSelect = (uploadedFile) => {
        if (!uploadedFile) return;
        if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
            alert('Please upload a valid .csv file.');
            return;
        }
        uploadFile(uploadedFile);
    };

    const handleTableActions = (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const fileId = parseInt(target.dataset.id);

        if (target.classList.contains('btn-delete')) {
            if (confirm('Are you sure you want to delete this upload record and all its associated contacts?')) {
                // TODO: Add an API call to delete this from the server
                // fetch(`/api/upload-history/${fileId}`, { method: 'DELETE' }).then(...)
                files = files.filter(f => f.id !== fileId);
                renderFiles();
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

    // --- INITIAL FETCH ---
    fetchUploadHistory();
});
