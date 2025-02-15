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
  window.addEventListener('scroll', handleScroll);   // Add scroll event listener
  
  handleScroll(); // Run once on initialization
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeHeaderScroll);

// ---------------- MOBILE HEADER -------------------- //

  function toggleMenu() {
    var menu = document.querySelector('.mobile-menu');
    menu.classList.toggle('mobile-menu-closed');
  }

  toggleMenu();

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
function initializeDashboard() {
  function initializeTabs() {
      const tabContainer = document.querySelector('.tabs.w-tabs');
      const tabLinks = document.querySelectorAll('.w-tab-link');
      const tabPanes = document.querySelectorAll('.w-tab-pane');
      
      tabLinks.forEach((tabLink, index) => {
          if (index === 0) {
              tabLink.classList.add('w--current');
              tabPanes[index].classList.add('w--tab-active');
          }
          
          tabLink.addEventListener('click', (e) => {
              e.preventDefault();
              
              tabLinks.forEach(link => {
                  link.classList.remove('w--current');
                  link.setAttribute('aria-selected', 'false');
                  link.setAttribute('tabindex', '-1');
              });
              
              tabPanes.forEach(pane => {
                  pane.classList.remove('w--tab-active');
              });
              
              tabLink.classList.add('w--current');
              tabLink.setAttribute('aria-selected', 'true');
              tabLink.setAttribute('tabindex', '0');
              tabPanes[index].classList.add('w--tab-active');
          });
      });
  }
  
  function initializeDropdowns() {
      const dropdowns = document.querySelectorAll('.category-dropdown-icon-2.w-dropdown');
      
      dropdowns.forEach(dropdown => {
          const toggle = dropdown.querySelector('.w-dropdown-toggle');
          const list = dropdown.querySelector('.w-dropdown-list');
          const arrow = dropdown.querySelector('.dropdown-arrow');
          let isOpen = false;
          
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
          
          const container = toggle.querySelector('.category-title-dropdown-container');
          if (container) {
              container.addEventListener('mouseenter', () => container.style.opacity = '0.8');
              container.addEventListener('mouseleave', () => container.style.opacity = '1');
          }
          
          document.addEventListener('click', (e) => {
              if (!dropdown.contains(e.target) && isOpen) {
                  isOpen = false;
                  list.classList.remove('w--open');
                  toggle.classList.remove('w--open');
                  arrow.style.transform = 'rotate(0deg)';
              }
          });
      });
  }
  
  function initializeBiomarkers() {
      const biomarkers = document.querySelectorAll('.biomarker-container');
      
      biomarkers.forEach(container => {
          const bottomContent = container.querySelector('.biomarker-bottom');
          const textbox = container.querySelector('.biomarker-textbox');
          const dropdownIcon = container.querySelector('.biomarker-dropdown');
          let isExpanded = false;
          
          // Add smooth transitions
          bottomContent.style.transition = 'height 0.3s ease';
          textbox.style.transition = 'all 0.3s ease';
          dropdownIcon.style.transition = 'transform 0.3s ease';
          
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
      });
  }

  // Initialize all dashboard components
  initializeTabs();
  initializeDropdowns();
  initializeBiomarkers();
}

// ---------------- INITIALIZATION -------------------- //
function initializeAll() {
  initializeHeaderScroll();
  toggleMenu();
  initializeDashboard();
  // Load charts if on reports page
  if (document.getElementById('biomarker-trend') && typeof Plotly !== 'undefined') {
    initializeBiomarkerChart();
}
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAll);

// ---------------- SEARCH BAR -------------------- //

document.addEventListener('DOMContentLoaded', function() {
    const searchContainer = document.querySelector('.search-container');
    const searchIcon = document.querySelector('.search-icon');
    const searchInput = document.querySelector('.search-input');
    const clearIcon = document.querySelector('.clear-icon');

    // Expand search on icon click
    searchIcon.addEventListener('click', () => {
        searchContainer.classList.add('expanded');
        searchInput.focus();
    });

    // Handle search input
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const activeTab = document.querySelector('.w-tab-pane.w--tab-active');
        
        // Handle clear button visibility
        if (searchTerm) {
            clearIcon.classList.remove('hidden');
            clearIcon.classList.add('visible');
        } else {
            clearIcon.classList.remove('visible');
            clearIcon.classList.add('hidden');
        }

        if (activeTab) {
            if (activeTab.getAttribute('data-w-tab') === 'All') {
                // Current logic for "All" tab works fine
                const biomarkerContainers = activeTab.querySelectorAll('.biomarker-container');
                biomarkerContainers.forEach(container => {
                    const text = container.textContent.toLowerCase();
                    container.style.display = text.includes(searchTerm) ? '' : 'none';
                });
            } else {
                // For Category and Frequency tabs
                const categoryContainers = activeTab.querySelectorAll('.dropdown-content-top');
                
                categoryContainers.forEach(categoryContainer => {
                    const biomarkerContainers = categoryContainer.querySelectorAll('.biomarker-container');
                    let hasMatch = false;

                    // Check if any biomarker in this category matches
                    biomarkerContainers.forEach(biomarkerContainer => {
                        const text = biomarkerContainer.textContent.toLowerCase();
                        const matches = text.includes(searchTerm);
                        biomarkerContainer.style.display = matches ? '' : 'none';
                        if (matches) hasMatch = true;
                    });

                    // Show/hide category container based on matches
                    categoryContainer.style.display = hasMatch ? '' : 'none';

                    // If there's a match, expand the category
                    if (hasMatch && searchTerm) {
                        const dropdownList = categoryContainer.querySelector('.category-dropdown-list');
                        const arrow = categoryContainer.querySelector('.dropdown-arrow');
                        if (dropdownList) dropdownList.classList.add('w--open');
                        if (arrow) arrow.classList.add('active');
                    }
                });
            }
        }
        // Collapse all categories when search is cleared
        if (!searchTerm) {
            document.querySelectorAll('.category-dropdown-list').forEach(list => {
                list.classList.remove('w--open');
            });
            document.querySelectorAll('.dropdown-arrow').forEach(arrow => {
                arrow.classList.remove('active');
            });
        }
    });

    // Clear search
    clearIcon.addEventListener('click', () => {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
    });

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            if (!searchInput.value) {
                searchContainer.classList.remove('expanded');
                clearIcon.classList.remove('visible');
                clearIcon.classList.add('hidden');
            }
        }
    });
});