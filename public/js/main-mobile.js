// ------ Mobile Menu JavaScript
document.addEventListener('DOMContentLoaded', function() {
  const hamburgerButton = document.getElementById('hamburger-button');
  const mobileMenu = document.querySelector('.mobile-nav');
  const mobileLinks = document.querySelectorAll('.mobile-menu .page-link');
  
  // Toggle mobile menu function
  function toggleMobileMenu() {
    // Toggle active class on button
    hamburgerButton.classList.toggle('open');
    
    // Toggle menu open class
    mobileMenu.classList.toggle('open');
    
    // Calculate actual height of mobile menu for pushing content
    const menuHeight = mobileMenu.scrollHeight;
    
    // Set the CSS variable for menu height
    document.documentElement.style.setProperty('--mobile-menu-height', mobileMenu.classList.contains('open') ? `${menuHeight}px` : '0px');
    
    // Toggle body class to push content
    document.body.classList.toggle('menu-open');
  }
  
  // Add event listener to hamburger button
  if (hamburgerButton) {
    hamburgerButton.addEventListener('click', toggleMobileMenu);
  }
  
  // Close menu when clicking navigation links
  mobileLinks.forEach(link => {
    link.addEventListener('click', function() {
      if (mobileMenu.classList.contains('open')) {
        toggleMobileMenu();
      }
    });
  });
  
  // Close menu on window resize
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768 && mobileMenu.classList.contains('open')) {
      hamburgerButton.classList.remove('open');
      mobileMenu.classList.remove('open');
      document.body.classList.remove('menu-open');
      document.documentElement.style.setProperty('--mobile-menu-height', '0px');
    }
  });
});

// Combine with your existing toggleMenu function
window.toggleMenu = function() {
  const hamburgerButton = document.getElementById('hamburger-button');
  
  if (hamburgerButton) {
    // Trigger click on hamburger to use the new toggle function
    hamburgerButton.click();
  } else {
    // Legacy fallback for older code
    var menu = document.querySelector('.mobile-menu');
    
    if (!menu) {
        console.warn("Element with class 'mobile-menu' not found. Cannot toggle menu.");
        return;
    }
    
    menu.classList.toggle('open');
    console.log('Menu toggled. Classes:', menu.className);
  }
}