# HealthLync - Personalized Health Tracker

A comprehensive health tracking application that enables users to make sense of complex medical information through intelligent data processing, OCR extraction, and AI-powered insights.

## Features

- **Landing Page** - Modern, responsive landing page with interactive elements
- **How It Works** - Step-by-step guide with React-powered scroll navigation
- **User Authentication** - Secure authentication with Passport.js
- **Document Upload & OCR** - Advanced OCR processing with Google's free OCR API
- **Interactive Dashboards** - Visual health data representation with Plotly.js
- **RAG Chatbot** - AI-powered medical information retrieval using vector search
- **Multi-Database Integration** - MongoDB for user data, PostgreSQL with pgvector for medical knowledge
- **Tutorial System** - Interactive onboarding experience for new users
- **Credits & Licensing** - Comprehensive attribution for all technologies and data sources

### Upcoming Features

- Active Content Management System
- PIPEDA & HIPAA Compliance
- Enhanced mobile experience

## Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with custom properties and animations
- **JavaScript** - Client-side interactivity
- **React** - Dynamic UI components
- **Handlebars** - Server-side templating engine
- **Plotly.js** - Interactive data visualization
- **Lucide** - Modern icon system

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **Passport.js** - Authentication middleware
- **Express-session** - Session management
- **Multer** - File upload handling
- **WebSocket** - Real-time communication

### Databases
- **MongoDB** - User data and session storage
- **PostgreSQL** with **pgvector** - Medical knowledge base with vector search
- **Connect-mongo** - Session store for MongoDB

### AI & Machine Learning
- **OpenAI API** - Text embeddings and completions
- **Anthropic Claude API** - Advanced language model for medical insights
- **Hugging Face Inference** - Mistral-7B-Instruct model integration
- **Together AI** - Additional AI model access

### OCR & Document Processing
- **PaddleOCR** - Primary OCR engine for medical documents
- **DocTR** - Advanced OCR with deep learning models
- **Tesseract.js** - Fallback OCR solution
- **PDF.js** - PDF text extraction
- **pdf-parse** - PDF processing
- **@google-cloud/documentai** - Google Cloud Document AI integration
- **@google-cloud/vision** - Google Cloud Vision API

### Communication
- **Resend** - Email delivery service
- **Axios** - HTTP client
- **node-fetch** - Fetch API for Node.js
- **form-data** - Form data handling

### Development Tools
- **Nodemon** - Development server with hot reload
- **@babel/core** - JavaScript transpiler
- **@babel/preset-react** - React JSX support

### Production Infrastructure
- **Vercel** - Frontend and API hosting
- **Digital Ocean** - Database hosting
- **Railway** - Additional backend services
- **Docker** - Containerization for OCR services

## Key Features Explained

### Document Processing Pipeline

1. **Upload**: User uploads medical documents (PDF, images)
2. **OCR Extraction**: DocTR or PaddleOCR extracts text
3. **Pattern Matching**: Lab patterns identify biomarker values
4. **Storage**: Data stored in MongoDB with user context
5. **Visualization**: Plotly.js renders interactive charts

### RAG (Retrieval Augmented Generation) System

1. **Document Chunking**: Medical knowledge split into semantic chunks
2. **Vector Embeddings**: OpenAI generates embeddings for each chunk
3. **Semantic Search**: pgvector finds relevant context using cosine similarity
4. **AI Response**: Claude or GPT generates informed responses with retrieved context

### Authentication Flow

1. **Registration**: Passport-local strategy with bcrypt password hashing
2. **Session Management**: Express-session with MongoDB store
3. **Protected Routes**: Middleware ensures authenticated access
4. **User Profiles**: Comprehensive user data and preferences

## Development Notes

### File Upload Handling

Files are stored in `public/uploads/` with metadata saved to MongoDB:
- File validation (type and size)
- Secure filename generation
- Error handling and logging

### Medical Knowledge Sources

The application includes curated medical information from:
- Peter Attia MD ("The Drive" podcast, "Outlive")
- Andrew Huberman (Huberman Lab)
- Rhonda Patrick (Found My Fitness)

### Database Design

- **MongoDB**: User data, sessions, uploaded documents, lab results
- **PostgreSQL**: Medical knowledge base, vector embeddings, semantic search
