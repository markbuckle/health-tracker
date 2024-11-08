// ---------------- HOME PAGE AND HOW-IT-WORKS -------------------- //

// Header scroll animation
function initializeHeaderScroll() {
  const header = document.getElementById('header');
  const headerContainer = document.getElementById('headerContainer');
  const logo = document.getElementById('logo');
  
  // Check if elements exist to prevent errors
  if (!header || !headerContainer || !logo) {
      console.warn('One or more header elements not found');
      return;
  }

  function handleScroll() {
      const scrollPosition = window.scrollY;
      
      if (scrollPosition > 50) {
          header.classList.add('header-scrolled');
          headerContainer.classList.add('header-container-scrolled');
          logo.classList.add('logo-scrolled');
      } else {
          header.classList.remove('header-scrolled');
          headerContainer.classList.remove('header-container-scrolled');
          logo.classList.remove('logo-scrolled');
      }
  }

  // Add scroll event listener
  window.addEventListener('scroll', handleScroll);
  
  // Run once on page load to set initial state
  handleScroll();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeHeaderScroll);

// ---------------- SIDEBAR - RESPONSIVE MOBILE -------------------- //
// function responsiveSidebar() {
//     document.addEventListener('DOMContentLoaded', () => {
//         const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
//         const sidebar = document.querySelector('.sidebar');

//         mobileMenuToggle.addEventListener('click', () => {
//             sidebar.classList.toggle('open');
//         });
//     });
// }
// responsiveSidebar();

  // ---------------- REPORTS PAGE - DASHBOARD INTERACTIONS -------------------- //

  // Main function to handle all dashboard interactions
  function initializeDashboard() {
    // Initialize tabs
    const initializeTabs = () => {
      const tabContainer = document.querySelector('.tabs.w-tabs');
      const tabLinks = document.querySelectorAll('.w-tab-link');
      const tabPanes = document.querySelectorAll('.w-tab-pane');
      
      tabLinks.forEach((tabLink, index) => {
        // Set initial states for first tab
        if (index === 0) {
          tabLink.classList.add('w--current');
          tabPanes[index].classList.add('w--tab-active');
        }
        
        tabLink.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Remove current states from all tabs
          tabLinks.forEach(link => {
            link.classList.remove('w--current');
            link.setAttribute('aria-selected', 'false');
            link.setAttribute('tabindex', '-1');
          });
          
          tabPanes.forEach(pane => {
            pane.classList.remove('w--tab-active');
          });
          
          // Set new current states
          tabLink.classList.add('w--current');
          tabLink.setAttribute('aria-selected', 'true');
          tabLink.setAttribute('tabindex', '0');
          tabPanes[index].classList.add('w--tab-active');
        });
      });
    };
    
    // Initialize dropdowns
    const initializeDropdowns = () => {
      const dropdowns = document.querySelectorAll('.category-dropdown-icon-2.w-dropdown');
      
      dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.w-dropdown-toggle');
        const list = dropdown.querySelector('.w-dropdown-list');
        const arrow = dropdown.querySelector('.dropdown-arrow');
        
        // Initialize state
        let isOpen = false;
        
        // Handle click events
        toggle.addEventListener('click', (e) => {
          e.preventDefault();
          isOpen = !isOpen;
          
          if (isOpen) {
            list.classList.add('w--open');
            toggle.classList.add('w--open');
            arrow.style.transform = 'rotate(180deg)';
          } else {
            list.classList.remove('w--open');
            toggle.classList.remove('w--open');
            arrow.style.transform = 'rotate(0deg)';
          }
        });
        
        // Handle hover effects
        const container = toggle.querySelector('.category-title-dropdown-container');
        if (container) {
          container.addEventListener('mouseenter', () => {
            container.style.opacity = '0.8';
          });
          
          container.addEventListener('mouseleave', () => {
            container.style.opacity = '1';
          });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
          if (!dropdown.contains(e.target) && isOpen) {
            isOpen = false;
            list.classList.remove('w--open');
            toggle.classList.remove('w--open');
            arrow.style.transform = 'rotate(0deg)';
          }
        });
      });
    };
    
    // Initialize biomarkers
    const initializeBiomarkers = () => {
      const biomarkers = document.querySelectorAll('.biomarker-container');
      
      biomarkers.forEach(container => {
        const bottomContent = container.querySelector('.biomarker-bottom');
        const textbox = container.querySelector('.biomarker-textbox');
        const dropdownIcon = container.querySelector('.biomarker-dropdown');
        
        let isExpanded = false;
        
        container.addEventListener('click', () => {
          isExpanded = !isExpanded;
          
          if (isExpanded) {
            bottomContent.style.height = bottomContent.scrollHeight + 'px';
            textbox.style.transform = 'translate3d(0, 0, 0)';
            textbox.style.opacity = '1';
            dropdownIcon.style.transform = 'rotate(180deg)';
          } else {
            bottomContent.style.height = '0px';
            textbox.style.transform = 'translate3d(0, 50%, 0)';
            textbox.style.opacity = '0';
            dropdownIcon.style.transform = 'rotate(0deg)';
          }
        });
        
        // Add smooth transitions
        bottomContent.style.transition = 'height 0.3s ease';
        textbox.style.transition = 'all 0.3s ease';
        dropdownIcon.style.transition = 'transform 0.3s ease';
      });
    };
  
    // Call all initialization functions
    initializeTabs();
    initializeDropdowns();
    initializeBiomarkers();
  }
  
  // Initialize everything when DOM is loaded
  document.addEventListener('DOMContentLoaded', initializeDashboard);