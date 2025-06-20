document.addEventListener('DOMContentLoaded', () => {
    const googleLoginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', () => {
            // Redirects the user to our backend's Google OAuth initiation route
            window.location.href = '/auth/google';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/auth/logout');
                if (response.ok) {
                    // Redirect to the home page after successful logout
                    window.location.href = '/';
                } else {
                    console.error('Logout failed:', response.statusText);
                    alert('Logout failed. Please try again.');
                }
            } catch (error) {
                console.error('Error during logout:', error);
                alert('An error occurred during logout. Please check your connection.');
            }
        });
    }
});