// ---------------- MOBILE HEADER -------------------- //

function toggleMenu() {
    var menu = document.querySelector('.mobile-menu');
    
    // Check if menu exists before trying to modify it
    if (!menu) {
        console.warn("Element with class 'mobile-menu' not found. Cannot toggle menu.");
        return; // Exit the function early if menu doesn't exist
    }
    
    // Toggle the mobile-menu-closed class
    menu.classList.toggle('mobile-menu-closed');
    
    // Log for debugging
    console.log('Menu toggled. Classes:', menu.className);
}

// Make toggleMenu available globally for the onclick handler
window.toggleMenu = toggleMenu;

// ------- New Mobile Menu JS
document.addEventListener('DOMContentLoaded', function() {
  const hamburgerButton = document.getElementById('hamburger-button');
  const mobileNav = document.getElementById('mobile-nav');
  
  // Only proceed if required elements exist
  if (!hamburgerButton || !mobileNav) {
    console.log('Mobile menu elements not found, skipping initialization');
    return;
  }
  
  // Toggle mobile menu function
  function toggleMobileMenu() {
    hamburgerButton.classList.toggle('open');
    mobileNav.classList.toggle('open');
    
    // Calculate actual height of mobile menu for pushing content
    const menuHeight = mobileNav.scrollHeight;
    
    // Set the CSS variable for menu height
    document.documentElement.style.setProperty('--mobile-menu-height', menuHeight + 'px');
    
    // Toggle body class to push content
    document.body.classList.toggle('menu-open');
  }
  
  // Add event listener
  hamburgerButton.addEventListener('click', toggleMobileMenu);
  
  // Close menu when clicking navigation links
  const menuLinks = mobileNav.querySelectorAll('a');
  menuLinks.forEach(link => {
    link.addEventListener('click', function() {
      // Small delay to allow the link to be followed
      setTimeout(() => {
        if (mobileNav.classList.contains('open')) {
          toggleMobileMenu();
        }
      }, 100);
    });
  });
  
  // Close menu on window resize
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768 && mobileNav.classList.contains('open')) {
      hamburgerButton.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.classList.remove('menu-open');
      document.documentElement.style.setProperty('--mobile-menu-height', '0px');
    }
  });
});