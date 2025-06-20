// public/js/auth.js - FINAL CORRECTED VERSION FOR DEPLOYMENT

document.addEventListener('DOMContentLoaded', () => {
    // Define the absolute URL of your live backend on Render
    const API_BASE_URL = 'https://my-quote-backend-q5i4.onrender.com';

    const googleLoginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            // CORRECTED: Point to the full backend URL to start the login process
            window.location.href = `${API_BASE_URL}/auth/google`;
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // CORRECTED: Also point to the full backend URL for logging out
            window.location.href = `${API_BASE_URL}/auth/logout`;
        });
    }
});