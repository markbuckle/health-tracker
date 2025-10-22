// Mobile logout functionality
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('mobileLogoutBtn');
    const logoutConfirmation = document.getElementById('logoutConfirmation');
    const logoutCancel = document.getElementById('logoutCancel');
    
    // Only initialize if elements exist (mobile view)
    if (!logoutBtn || !logoutConfirmation || !logoutCancel) {
        return;
    }
    
    // Toggle logout confirmation
    logoutBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        logoutConfirmation.classList.toggle('show');
    });
    
    // Hide confirmation when clicking cancel
    logoutCancel.addEventListener('click', function() {
        logoutConfirmation.classList.remove('show');
    });
    
    // Hide confirmation when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.mobile-logout-container')) {
            logoutConfirmation.classList.remove('show');
        }
    });
    
    // Prevent confirmation from closing when clicking inside it
    logoutConfirmation.addEventListener('click', function(e) {
        e.stopPropagation();
    });
    
    // Handle escape key to close
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && logoutConfirmation.classList.contains('show')) {
            logoutConfirmation.classList.remove('show');
        }
    });
});