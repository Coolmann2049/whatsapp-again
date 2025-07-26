document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT REFERENCES ---

    const mediaTypesSelect = document.getElementById('media-types');
    
    // Initialize Choices.js on the select element
    const choices = new Choices(mediaTypesSelect, {
        removeItemButton: true, // Adds a small 'x' to remove selected items
    });
    
    const switches = {
        delay: document.getElementById('delay-switch'),
        media: document.getElementById('media-switch'),
        autoReply: document.getElementById('autoreply-switch'),
    };

    const controls = {
        delay: document.getElementById('delay-controls'),
        media: document.getElementById('media-controls'),
        autoReply: document.getElementById('autoreply-controls'),
    };
    
    const saveButton = document.getElementById('save-config-btn');
    const saveAlert = document.getElementById('save-alert');
    const allFormElements = document.querySelectorAll('.form-control, .form-select, .form-check-input');

    // --- HELPER FUNCTION ---
    const toggleSection = (sectionName) => {
        const isEnabled = switches[sectionName].checked;
        controls[sectionName].classList.toggle('form-section-disabled', !isEnabled);
    };

    // --- EVENT HANDLERS ---
    const handleSave = () => {
        // In a real app, gather all data and send to a backend.
        const configData = {
            messageDelay: {
                enabled: switches.delay.checked,
                minDelay: document.getElementById('min-delay').value,
                maxDelay: document.getElementById('max-delay').value,
            },
            mediaMessages: {
                enabled: switches.media.checked,
                allowedTypes: Array.from(document.getElementById('media-types').selectedOptions).map(opt => opt.value),
                maxFileSize: document.getElementById('max-filesize').value,
            },
            autoReply: {
                enabled: switches.autoReply.checked,
                outsideHours: document.getElementById('outside-hours-switch').checked,
                customMessage: document.getElementById('autoreply-message').value,
            },
        };
        console.log("Saving Configuration:", configData); // Simulate saving

        // Show success alert
        saveAlert.classList.remove('d-none');
        // Hide it after 3 seconds
        setTimeout(() => {
            saveAlert.classList.add('d-none');
        }, 3000);
    };

    // --- ATTACH EVENT LISTENERS ---
    Object.keys(switches).forEach(sectionName => {
        switches[sectionName].addEventListener('change', () => toggleSection(sectionName));
    });
    
    saveButton.addEventListener('click', handleSave);

    // Hide the save alert on any form change
    allFormElements.forEach(el => {
        el.addEventListener('input', () => {
            saveAlert.classList.add('d-none');
        });
    });

    // --- INITIAL STATE SETUP ---
    // Set the initial enabled/disabled state for all sections on page load
    Object.keys(controls).forEach(toggleSection);
});