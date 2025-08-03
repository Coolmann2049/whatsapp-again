document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let dialogFlows = [];

    // --- DOM REFERENCES ---
    const masterSwitch = document.getElementById('master-autoreply-switch');
    const settingsContainer = document.getElementById('settings-container');
    const modeToggle = document.getElementById('mode-toggle-switch');
    const modeLabel = document.getElementById('mode-label');
    const aiModeView = document.getElementById('ai-mode-view');
    const menuModeView = document.getElementById('menu-mode-view');
    const dialogFlowList = document.getElementById('dialog-flow-list');
    
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
            // Populate parent dropdown
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
    const fetchDialogFlows = async () => {
        try {
            const response = await fetch('/api/data/dialog-flows');
            if (!response.ok) throw new Error('Failed to fetch dialog flows');
            dialogFlows = await response.json();
            renderDialogFlows();
        } catch (error) {
            console.error(error);
            dialogFlowList.innerHTML = '<p class="text-center text-danger p-3">Could not load dialog flows.</p>';
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
            await fetchDialogFlows(); // Refresh the list
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
            
            await fetchDialogFlows(); // Refresh the list
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
            modeLabel.textContent = isAiMode ? 'AI-Powered Replies' : 'Menu-Driven Replies';
            aiModeView.classList.toggle('d-none', !isAiMode);
            menuModeView.classList.toggle('d-none', isAiMode);
        }
    };

    // --- ATTACH EVENT LISTENERS ---
    masterSwitch.addEventListener('change', updateViewState);
    modeToggle.addEventListener('change', updateViewState);
    saveFlowBtn.addEventListener('click', saveDialogFlow);

    dialogFlowList.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-flow');
        if (deleteBtn) {
            deleteDialogFlow(deleteBtn.dataset.id);
        }
    });

    createFlowModalEl.addEventListener('hidden.bs.modal', () => {
        dialogFlowForm.reset(); // Clear form when modal is closed
    });

    // --- INITIALIZATION ---
    const init = async () => {
        // TODO: In a real app, fetch the initial state of the toggles from the server
        // For now, we'll set a default state
        masterSwitch.checked = true;
        modeToggle.checked = true; // Default to AI mode

        await fetchDialogFlows();
        updateViewState();
    };

    init();
});