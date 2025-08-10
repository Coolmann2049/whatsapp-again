document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let dialogFlows = [];
    let initialReplyMode = 'off';

    // --- DOM REFERENCES ---
    const masterSwitch = document.getElementById('master-autoreply-switch');
    const settingsContainer = document.getElementById('settings-container');
    const modeToggle = document.getElementById('mode-toggle-switch');
    const modeLabel = document.getElementById('mode-label');
    const aiModeView = document.getElementById('ai-mode-view');
    const menuModeView = document.getElementById('menu-mode-view');
    const dialogFlowList = document.getElementById('dialog-flow-list');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const saveAlert = document.getElementById('save-alert');
    
    // Modal elements
    const createFlowModalEl = document.getElementById('createFlowModal');
    const createFlowModal = new bootstrap.Modal(createFlowModalEl);
    const dialogFlowForm = document.getElementById('dialog-flow-form');
    const triggerInput = document.getElementById('trigger-message');
    const responseInput = document.getElementById('response-message');
    const parentSelect = document.getElementById('parent-flow');
    const saveFlowBtn = document.getElementById('save-flow-btn');

    // --- RENDER FUNCTIONS ---
    const renderDialogFlows = () => {
        dialogFlowList.innerHTML = ''; // Clear list
        parentSelect.innerHTML = '<option value="">None (This is a top-level trigger)</option>'; // Reset dropdown

        if (dialogFlows.length === 0) {
            dialogFlowList.innerHTML = '<p class="text-center text-muted p-3">No dialog flows created yet. Click "Create New Flow" to start.</p>';
            return;
        }

        const flowsById = {};
        dialogFlows.forEach(flow => flowsById[flow.id] = { ...flow, children: [] });
        
        const tree = [];
        dialogFlows.forEach(flow => {
            if (flow.parent_id) {
                flowsById[flow.parent_id]?.children.push(flowsById[flow.id]);
            } else {
                tree.push(flowsById[flow.id]);
            }
            const option = new Option(flow.trigger_message.substring(0, 30), flow.id);
            parentSelect.add(option);
        });

        const generateHtml = (nodes, level = 0) => {
            let html = '';
            nodes.forEach(node => {
                html += `
                    <div class="list-group-item" style="padding-left: ${1.25 + level * 2}rem;">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <p class="mb-1"><strong>Trigger:</strong> <span class="text-primary">"${node.trigger_message}"</span></p>
                                <p class="mb-0 text-muted small"><strong>Response:</strong> ${node.response_message.substring(0, 100)}...</p>
                            </div>
                            <button class="btn btn-sm btn-outline-danger btn-delete-flow" data-id="${node.id}"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                `;
                if (node.children.length > 0) {
                    html += generateHtml(node.children, level + 1);
                }
            });
            return html;
        };

        dialogFlowList.innerHTML = generateHtml(tree);
    };

    // --- API FUNCTIONS ---
    const fetchInitialData = async () => {
        try {
            const response = await fetch('/api/data/dialog-flows');
            if (!response.ok) throw new Error('Failed to fetch initial data');
            const data = await response.json();
            
            dialogFlows = data.flows || [];
            initialReplyMode = data.reply_mode || 'off';

            masterSwitch.checked = initialReplyMode !== 'off';
            modeToggle.checked = initialReplyMode === 'ai';

            renderDialogFlows();
            updateViewState();
        } catch (error) {
            console.error(error);
            alert('Could not load settings. Please refresh the page.');
        }
    };

    const saveReplyMode = async () => {
        let newMode = 'off';
        if (masterSwitch.checked) {
            newMode = modeToggle.checked ? 'ai' : 'keyword';
        }

        saveSettingsBtn.disabled = true;
        saveSettingsBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        try {
            const response = await fetch('/api/data/reply-mode', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reply_mode: newMode })
            });

            if (!response.ok) throw new Error('Failed to save settings');

            initialReplyMode = newMode;
            saveAlert.classList.remove('d-none');
            setTimeout(() => saveAlert.classList.add('d-none'), 3000);

        } catch (error) {
            console.error(error);
            alert('Error: Could not save settings.');
        } finally {
            saveSettingsBtn.innerHTML = '<i class="bi bi-save me-2"></i>Save Changes';
        }
    };

    const saveDialogFlow = async () => {
        const trigger = triggerInput.value.trim();
        const response = responseInput.value.trim();
        const parentId = parentSelect.value ? parseInt(parentSelect.value) : null;

        if (!trigger || !response) {
            alert('Trigger and Response messages are required.');
            return;
        }

        try {
            const res = await fetch('/api/data/dialog-flows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trigger_message: trigger,
                    response_message: response,
                    parent_id: parentId
                })
            });
            if (!res.ok) throw new Error('Failed to save flow');
            
            createFlowModal.hide();
            await fetchInitialData(); // Refresh all data
        } catch (error) {
            console.error(error);
            alert('Error: Could not save the dialog flow.');
        }
    };

    const deleteDialogFlow = async (id) => {
        if (!confirm('Are you sure you want to delete this flow? Deleting a parent will also delete all its children.')) return;

        try {
            const res = await fetch(`/api/data/dialog-flows/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete flow');
            
            await fetchInitialData(); // Refresh all data
        } catch (error) {
            console.error(error);
            alert('Error: Could not delete the dialog flow.');
        }
    };

    // --- EVENT HANDLERS ---
    const updateViewState = () => {
        const isMasterOn = masterSwitch.checked;
        settingsContainer.classList.toggle('d-none', !isMasterOn);

        if (isMasterOn) {
            const isAiMode = modeToggle.checked;
            modeLabel.textContent = isAiMode ? 'AI-Powered Replies' : 'Keyword-Based Replies';
            aiModeView.classList.toggle('d-none', !isAiMode);
            menuModeView.classList.toggle('d-none', isAiMode);
        }
        
        let currentMode = 'off';
        if (masterSwitch.checked) {
            currentMode = modeToggle.checked ? 'ai' : 'keyword';
        }
        saveSettingsBtn.disabled = (currentMode === initialReplyMode);
    };

    // --- ATTACH EVENT LISTENERS ---
    masterSwitch.addEventListener('change', updateViewState);
    modeToggle.addEventListener('change', updateViewState);
    saveSettingsBtn.addEventListener('click', saveReplyMode);
    saveFlowBtn.addEventListener('click', saveDialogFlow);

    // THIS IS THE CORRECTED PART
    dialogFlowList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-flow');
        if (deleteBtn) {
            deleteDialogFlow(deleteBtn.dataset.id);
        }
    });

    createFlowModalEl.addEventListener('hidden.bs.modal', () => {
        dialogFlowForm.reset();
    });

    // --- INITIALIZATION ---
    fetchInitialData();
});