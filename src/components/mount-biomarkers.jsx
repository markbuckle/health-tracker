import React from 'react';
import ReactDOM from 'react-dom/client';
import BiomarkersAccordion from './BiomarkersAccordion';
import '../styles/tailwind.css';

// This will run when the page loads
if (typeof window !== 'undefined') {
  const mountPoint = document.getElementById('biomarkers-root');
  if (mountPoint) {
    const root = ReactDOM.createRoot(mountPoint);
    root.render(<BiomarkersAccordion />);
  }
}