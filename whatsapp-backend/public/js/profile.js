document.addEventListener('DOMContentLoaded', () => {

    // --- INITIALIZATION ---
    checkAuthentication();

    setupEventListeners();
});

const checkAuthentication = async () => {
    try {
        const response = await fetch('/api/user/check-auth', {
            method: 'GET',
            credentials: 'include', // Important for sending cookies
        });

        if (response.ok) {
            const userData = await response.json();
            showProfile(userData);
        } else {
            showLoggedOut();
        }
    } catch (error) {
        console.error('Network error during auth check:', error);
        showLoggedOut('Network error. Is the backend running?');
    }
};

function setupEventListeners() {
    
    const loginBtn = document.getElementById('login-btn');
    loginBtn.addEventListener('click', async () => {

        const loadingState = document.getElementById('loading-state');
        const loggedOutState = document.getElementById('logged-out-state');
        const loginModal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
        const loginEmailInput = document.getElementById('login-email');
        const loginPasswordInput = document.getElementById('login-password');
        const loginErrorAlert = document.getElementById('login-error-alert');

        loginErrorAlert.classList.add('d-none');
        const email = loginEmailInput.value;
        const password = loginPasswordInput.value;
        
        try {
            const response = await fetch('/api/user/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (response.ok) {
                loginModal.hide();
                loadingState.classList.remove('d-none'); // Show loading spinner
                loggedOutState.classList.add('d-none');
                await checkAuthentication(); // Re-check auth to fetch data
            } else {
                const errorData = await response.json();
                loginErrorAlert.textContent = errorData.message || 'Login failed.';
                loginErrorAlert.classList.remove('d-none');
            }
        } catch (error) {
            loginErrorAlert.textContent = 'Network error during login.';
            loginErrorAlert.classList.remove('d-none');
        }
    });
    
    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn.addEventListener('click', async () => {
        try {
            // Assumes you have a /logout endpoint that clears the session cookie
            await fetch('/api/user/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Error during logout:', error);
        } finally {
            // Always show logged out screen after attempting to log out
            showLoggedOut();
        }
    });

    const saveBtn = document.getElementById('save-changes-btn');
    if (saveBtn) {
       saveBtn.addEventListener('click', handleSave);
    }

    const form = document.getElementById('profile-form');
    if (form) {
        form.addEventListener('change', async (event) => {
            const file = event.target.files[0];
        
            // If the user cancels the file selection, do nothing
            if (!file) {
                return;
            }

            // 4. Create a new FormData object programmatically
            // This is the key to fixing the error. We build it ourselves.
            const formData = new FormData();
            // The first argument 'profilePhoto' must match the name Multer expects on the backend.
            formData.append('profilePhoto', file);

            try {
                const response = await fetch('/api/user/profile-photo', {
                method: 'POST',
                body: formData, // No 'Content-Type' header needed, browser sets it automatically
                });

                if (response.ok) {
                const result = await response.json();
                
                console.log('Upload successful:', result);

                const avatarPlaceholder = document.getElementById('profile-avatar-initial');
                if (avatarPlaceholder) {
                    const avatarImage = document.createElement('img');
                    avatarImage.src = result.photoUrl;
                    avatarImage.alt = 'Profile Avatar';
                    avatarImage.className = 'profile-avatar mx-auto mb-2'; // Keep the same classes for styling
                    avatarPlaceholder.replaceWith(avatarImage);
                }
                // Update the user's profile picture on the page
                } else {
                console.error('Upload failed.');
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }); 
    }
}

// Helper Functions 
function populateProfileForm(profileData) {

    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const profileAvatarInitial = document.getElementById('profile-avatar-initial');
    const profilePhoneInput = document.getElementById('profile-phone');
    const profileCompanyInput = document.getElementById('profile-company');
    const profileBusinessHoursInputStart = document.getElementById('profile-business-hours-start');
    const profileBusinessHoursInputEnd = document.getElementById('profile-business-hours-end');

    profileNameInput.value = profileData.name || '';
    profileEmailInput.value = profileData.email || '';
    if (profileData.name) {
        profileAvatarInitial.textContent = profileData.name.charAt(0).toUpperCase();
    }
    profilePhoneInput.value = profileData.phone_number || '';
    profileCompanyInput.value = profileData.company || '';
    profileBusinessHoursInputStart.value = profileData.business_hours.start || '';
    profileBusinessHoursInputEnd.value = profileData.business_hours.end || '';

    // Notifications
    const notifEmailNewMessage = document.getElementById('email-new-message');
    const notifEmailDailyReport = document.getElementById('email-daily-report');
    const notifEmailWeeklyReport = document.getElementById('email-weekly-report');

    const notifWhatsappNewMessage = document.getElementById('whatsapp-new-message');
    const notifWhatsappSystemAlerts = document.getElementById('whatsapp-system-alerts');

    const notifSystemLowBalance = document.getElementById('system-low-balance');
    const notifSystemErrorAlerts = document.getElementById('system-error-alerts');
    const notifSystemUpdates = document.getElementById('system-updates');

    notifEmailNewMessage.checked = profileData.notification_settings.email.new_message || false;
    notifEmailDailyReport.checked = profileData.notification_settings.email.daily_report || false;
    notifEmailWeeklyReport.checked = profileData.notification_settings.email.weekly_report || false;

    notifWhatsappNewMessage.checked = profileData.notification_settings.whatsapp.new_message || false;
    notifWhatsappSystemAlerts.checked = profileData.notification_settings.whatsapp.system_alerts || false;

    notifSystemLowBalance.checked = profileData.notification_settings.system.low_balance || false;
    notifSystemErrorAlerts.checked = profileData.notification_settings.system.error_alerts || false;
    notifSystemUpdates.checked = profileData.notification_settings.system.system_alerts || false;

    if (profileData.profile_photo_url) {
        const avatarPlaceholder = document.getElementById('profile-avatar-initial');
                if (avatarPlaceholder) {
                    const avatarImage = document.createElement('img');
                    avatarImage.src = profileData.profile_photo_url;
                    avatarImage.alt = 'Profile Avatar';
                    avatarImage.className = 'profile-avatar mx-auto mb-2'; // Keep the same classes for styling
                    avatarPlaceholder.replaceWith(avatarImage);
                }
    }
    
};

const showProfile = (userData) => {
    const loadingState = document.getElementById('loading-state');
    const loggedOutState = document.getElementById('logged-out-state');
    const profileContent = document.getElementById('profile-content');

    loadingState.classList.add('d-none');
    loggedOutState.classList.add('d-none');
    profileContent.classList.remove('d-none');
    populateProfileForm(userData.profile || {});
};

const showLoggedOut = (error = null) => {
    const loadingState = document.getElementById('loading-state');
    const loggedOutState = document.getElementById('logged-out-state');
    const profileContent = document.getElementById('profile-content');

    loadingState.classList.add('d-none');
    profileContent.classList.add('d-none');
    loggedOutState.classList.remove('d-none');
    // Optionally display an error on the logged-out screen
};

const handleSave = async () => {

    const profileNameInput = document.getElementById('profile-name');
    const profileEmailInput = document.getElementById('profile-email');
    const profilePhoneInput = document.getElementById('profile-phone');
    const profileCompanyInput = document.getElementById('profile-company');
    const profileBusinessHoursInputStart = document.getElementById('profile-business-hours-start');
    const profileBusinessHoursInputEnd = document.getElementById('profile-business-hours-end');

    // Gather notification settings
    const notifEmailNewMessage = document.getElementById('email-new-message');
    const notifEmailDailyReport = document.getElementById('email-daily-report');
    const notifEmailWeeklyReport = document.getElementById('email-weekly-report');
    const notifWhatsappNewMessage = document.getElementById('whatsapp-new-message');
    const notifWhatsappSystemAlerts = document.getElementById('whatsapp-system-alerts');
    const notifSystemLowBalance = document.getElementById('system-low-balance');
    const notifSystemErrorAlerts = document.getElementById('system-error-alerts');
    const notifSystemUpdates = document.getElementById('system-updates');

    const businessHours = {
        start: profileBusinessHoursInputStart.value,
        end: profileBusinessHoursInputEnd.value
    };

    const notification_settings = {
        email: {
            new_message: notifEmailNewMessage.checked,
            daily_report: notifEmailDailyReport.checked,
            weekly_report: notifEmailWeeklyReport.checked
        },
        whatsapp: {
            new_message: notifWhatsappNewMessage.checked,
            system_alerts: notifWhatsappSystemAlerts.checked
        },
        system: {
            low_balance: notifSystemLowBalance.checked,
            error_alerts: notifSystemErrorAlerts.checked,
            system_updates: notifSystemUpdates.checked
        }
    };

    const saveSuccessAlert = document.getElementById('save-success-alert');
    const saveErrorAlert = document.getElementById('save-error-alert');

    saveSuccessAlert.classList.add('d-none');
    saveErrorAlert.classList.add('d-none');

    // Gather all data from the form
    const dataToSave = {
        profile: {
            name: profileNameInput.value,
            email: profileEmailInput.value,
            phone_number: profilePhoneInput.value,
            company: profileCompanyInput.value,
            notifications: notification_settings,
            business_hours: businessHours
        }        
    };

    try {
        const response = await fetch('/api/user/profile', {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });

        if (response.ok) {
            saveSuccessAlert.textContent = 'Settings saved successfully!';
            saveSuccessAlert.classList.remove('d-none');
            setTimeout(() => saveSuccessAlert.classList.add('d-none'), 3000);
        } else {
            const errorData = await response.json();
            saveErrorAlert.textContent = errorData.message || 'Failed to save settings.';
            saveErrorAlert.classList.remove('d-none');
        }
    } catch (error) {
        saveErrorAlert.textContent = 'Network error while saving settings.';
        saveErrorAlert.classList.remove('d-none');
    }
}

function addProfilePhoto() {
}