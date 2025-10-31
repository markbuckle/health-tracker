// ===================================
// MODERN CHATBOT FUNCTIONALITY
// Preserves all existing RAG, database, and biomarker integration
// ===================================

(function() {
  'use strict';

  // ===================================
  // STATE MANAGEMENT
  // ===================================
  
  let conversationHistory = []; // Maintains last 10 messages for RAG context
  let currentConversationId = null;
  let conversations = [];
  let userId = null;
  let userContext = null;

  // ===================================
  // DOM ELEMENTS
  // ===================================

  const elements = {
    welcomeState: null,
    chatInterface: null,
    chatMessages: null,
    chatInput: null,
    chatSubmit: null,
    clearBtn: null,
    newConversationBtn: null,
    conversationList: null,
    conversationSearch: null,
    infoButton: null,
    suggestionBtns: null,
    welcomeInput: null,
    welcomeSubmit: null,
    welcomeUserName: null,
  };

  // ===================================
  // INITIALIZATION
  // ===================================

  function init() {
    console.log('🚀 Initializing modern chatbot...');
    
    // Cache DOM elements
    cacheElements();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load user data and conversations
    loadInitialData();
    
    // Show welcome state by default
    showWelcomeState();
  }

  function cacheElements() {
    elements.welcomeState = document.getElementById('welcome-state');
    elements.chatInterface = document.getElementById('chat-interface');
    elements.chatMessages = document.getElementById('chat-messages');
    elements.chatInput = document.getElementById('chat-input');
    elements.chatSubmit = document.getElementById('chat-submit');
    elements.clearBtn = document.getElementById('clear-conversation-btn');
    elements.newConversationBtn = document.getElementById('new-conversation-btn');
    elements.conversationList = document.getElementById('conversation-list');
    elements.conversationSearch = document.getElementById('conversation-search-input');
    elements.infoButton = document.querySelector('.info-button');
    elements.suggestionBtns = document.querySelectorAll('.suggestion-btn');
    elements.welcomeInput = document.getElementById('welcome-input');
    elements.welcomeSubmit = document.getElementById('welcome-submit');
    elements.welcomeUserName = document.getElementById('welcome-user-name');
  }

  function setupEventListeners() {
    // Input handling
    elements.chatInput.addEventListener('input', handleInputResize);
    elements.chatInput.addEventListener('keydown', handleInputKeydown);
    
    // Submit button
    elements.chatSubmit.addEventListener('click', submitMessage);
    
    // Clear conversation
    elements.clearBtn.addEventListener('click', handleClearConversation);
    
    // New conversation
    elements.newConversationBtn.addEventListener('click', handleNewConversation);
    
    // Info button
    elements.infoButton.addEventListener('click', showInfoModal);
    
    // Suggestion buttons
    elements.suggestionBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const query = this.getAttribute('data-query');
        if (query) {
          elements.chatInput.value = query;
          submitMessage();
        }
      });
    });
    
    // Welcome input handling
    if (elements.welcomeInput) {
      elements.welcomeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitWelcomeMessage();
        }
      });
    }
    
    if (elements.welcomeSubmit) {
      elements.welcomeSubmit.addEventListener('click', submitWelcomeMessage);
    }
    
    // Welcome input handling
    if (elements.welcomeInput) {
      elements.welcomeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitWelcomeMessage();
        }
      });
    }
    
    if (elements.welcomeSubmit) {
      elements.welcomeSubmit.addEventListener('click', submitWelcomeMessage);
    }
    
    // Conversation search
    if (elements.conversationSearch) {
      elements.conversationSearch.addEventListener('input', handleConversationSearch);
    }
    
    // Welcome input handlers
    if (elements.welcomeInput) {
      elements.welcomeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitWelcomeMessage();
        }
      });
    }
    
    if (elements.welcomeSubmit) {
      elements.welcomeSubmit.addEventListener('click', submitWelcomeMessage);
    }
  }

  // ===================================
  // INITIAL DATA LOADING
  // ===================================

  async function loadInitialData() {
    try {
      // Get user ID and context (existing functionality)
      await loadUserData();
      
      // Load conversation history
      await loadConversations();
      
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  async function loadUserData() {
    try {
      console.log('Getting current user ID...');
      const userIdResponse = await fetch("/api/current-user");
      
      if (userIdResponse.ok) {
        const userData = await userIdResponse.json();
        userId = userData.userId;
        console.log('User ID retrieved:', userId);
        
        // Get user context with biomarker data
        const contextResponse = await fetch("/api/rag/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: userId })
        });
        
        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          userContext = contextData.userContext;
          console.log('User context loaded:', userContext);
          
          // Update welcome screen with user's name - check multiple possible locations
          if (elements.welcomeUserName) {
            const firstName = userData.firstName || 
                            userContext?.profile?.firstName || 
                            userContext?.firstName ||
                            'there';
            elements.welcomeUserName.textContent = firstName;
          }
        }
      } else {
        console.log('User not authenticated, proceeding without context');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  async function loadConversations() {
    // If no userId, can't load conversations from database
    if (!userId) {
      console.log('No user ID, skipping conversation load');
      showEmptyConversationState();
      return;
    }
    
    try {
      console.log('📥 Loading conversations from database...');
      
      const response = await fetch('/api/rag/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          operation: 'list',
          userId 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        conversations = data.conversations || [];
        
        console.log(`✅ Loaded ${conversations.length} conversations`);
        
        if (conversations.length > 0) {
          renderConversationList(conversations);
        } else {
          showEmptyConversationState();
        }
      } else {
        console.error('Failed to load conversations:', response.status);
        showEmptyConversationState();
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      showEmptyConversationState();
    }
  }

  // ===================================
  // CONVERSATION MANAGEMENT
  // ===================================

  function handleNewConversation() {
    // Clear current conversation
    currentConversationId = null;
    conversationHistory = [];
    elements.chatMessages.innerHTML = '';
    
    // Show welcome state
    showWelcomeState();
    
    // Clear active state from conversation list
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Clear input
    elements.chatInput.value = '';
    
    // Update subtitle
    document.getElementById('current-conversation-title').textContent = '';
  }

  async function handleClearConversation() {
    if (!confirm('Clear this conversation? This cannot be undone.')) {
      return;
    }
    
    // Clear conversation history
    conversationHistory = [];
    elements.chatMessages.innerHTML = '';
    
    // Show welcome state
    showWelcomeState();
    
    // If there's a current conversation, delete it
    if (currentConversationId) {
      await deleteConversation(currentConversationId);
      currentConversationId = null;
    }
  }

  async function saveConversation(title, messages) {
    // If no userId, can't save to database
    if (!userId) {
      console.log('No user ID, skipping conversation save');
      return;
    }
    
    const conversation = {
      operation: 'save',
      id: currentConversationId || null,
      title: title || generateConversationTitle(messages),
      messages: messages,
      userId: userId
    };
    
    try {
      console.log('💾 Saving conversation to database...');
      
      const response = await fetch('/api/rag/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversation)
      });
      
      if (response.ok) {
        const data = await response.json();
        currentConversationId = data.conversationId;
        
        console.log('✅ Conversation saved:', currentConversationId);
        
        // Reload conversation list to show updated data
        await loadConversations();
      } else {
        console.error('Failed to save conversation:', response.status);
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  async function loadConversation(conversationId) {
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (!conversation) {
      console.error('Conversation not found:', conversationId);
      return;
    }
    
    // Set current conversation
    currentConversationId = conversationId;
    
    // Clear and rebuild messages
    elements.chatMessages.innerHTML = '';
    
    // Rebuild conversation history array
    conversationHistory = conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Render messages in UI
    conversation.messages.forEach(msg => {
      if (msg.role === 'user') {
        addMessageToUI(msg.content, 'user', msg.timestamp);
      } else if (msg.role === 'assistant') {
        addMessageToUI(msg.content, 'assistant', msg.timestamp);
      }
    });
    
    // Show chat interface
    showChatInterface();
    
    // Update subtitle
    document.getElementById('current-conversation-title').textContent = conversation.title;
    
    // Scroll to bottom
    scrollToBottom();
  }

  async function deleteConversation(conversationId) {
    // If no userId, can't delete from database
    if (!userId) {
      console.log('No user ID, skipping conversation delete');
      return;
    }
    
    try {
      console.log('🗑️ Deleting conversation from database...');
      
      const response = await fetch('/api/rag/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          operation: 'delete',
          conversationId, 
          userId 
        })
      });
      
      if (response.ok) {
        console.log('✅ Conversation deleted');
        
        // Reload conversation list
        await loadConversations();
      } else {
        console.error('Failed to delete conversation:', response.status);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }

  // ===================================
  // MESSAGE HANDLING (Existing RAG Functionality)
  // ===================================

  function submitWelcomeMessage() {
    const message = elements.welcomeInput.value.trim();
    if (!message) return;
    
    // Transfer message to main chat input
    elements.chatInput.value = message;
    
    // Clear welcome input
    elements.welcomeInput.value = '';
    
    // Submit the message (this will show chat interface and send to RAG)
    submitMessage();
  }

  function submitMessage() {
    const message = elements.chatInput.value.trim();
    if (!message) return;
    
    // Show chat interface if in welcome state
    if (elements.welcomeState.style.display !== 'none') {
      showChatInterface();
    }
    
    // Add user message to UI
    addMessageToUI(message, 'user');
    
    // Add to conversation history for RAG context
    conversationHistory.push({
      role: "user",
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 messages to avoid token limits
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }
    
    // Clear input
    elements.chatInput.value = '';
    elements.chatInput.style.height = 'auto';
    
    // Show typing indicator
    addTypingIndicator();
    
    // Send to RAG API (existing functionality preserved)
    sendToRAG(message);
  }

  function submitWelcomeMessage() {
    const message = elements.welcomeInput.value.trim();
    if (!message) return;
    
    // Clear welcome input
    elements.welcomeInput.value = '';
    
    // Show chat interface
    showChatInterface();
    
    // Add user message to UI
    addMessageToUI(message, 'user');
    
    // Add to conversation history for RAG context
    conversationHistory.push({
      role: "user",
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 messages to avoid token limits
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }
    
    // Show typing indicator
    addTypingIndicator();
    
    // Send to RAG API
    sendToRAG(message);
  }

  function submitWelcomeMessage() {
    const message = elements.welcomeInput.value.trim();
    if (!message) return;
    
    // Clear welcome input
    elements.welcomeInput.value = '';
    
    // Show chat interface
    showChatInterface();
    
    // Add user message to UI
    addMessageToUI(message, 'user');
    
    // Add to conversation history for RAG context
    conversationHistory.push({
      role: "user",
      content: message,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 messages to avoid token limits
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }
    
    // Show typing indicator
    addTypingIndicator();
    
    // Send to RAG API
    sendToRAG(message);
  }

  async function sendToRAG(query) {
    try {
      // EXISTING FUNCTIONALITY: Send to RAG with user context
      const response = await fetch("/api/rag/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          query,
          userContext: userContext,
          conversationHistory: conversationHistory
        }),
      });

      const data = await response.json();
      
      // Remove typing indicator
      removeTypingIndicator();
      
      // Add assistant response to conversation history
      conversationHistory.push({
        role: "assistant",
        content: data.response,
        timestamp: new Date().toISOString()
      });
      
      // Add response to UI
      addMessageToUI(data.response, 'assistant');
      
      // Store sources for info button (existing functionality)
      window.lastSources = data.sources;
      
      // Auto-save conversation after each exchange
      await saveConversation(null, conversationHistory);
      
    } catch (error) {
      console.error("RAG Error:", error);
      removeTypingIndicator();
      addMessageToUI(
        "Sorry, I couldn't process your request. Please try again.",
        "assistant"
      );
    }
  }

  // ===================================
  // UI MESSAGE RENDERING
  // ===================================

  function addMessageToUI(message, sender, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}-message`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? 'Y' : 'R';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    const header = document.createElement('div');
    header.className = 'message-header';
    
    const senderName = document.createElement('span');
    senderName.className = 'message-sender';
    senderName.textContent = sender === 'user' ? 'You' : 'Reed';
    
    const timestampEl = document.createElement('span');
    timestampEl.className = 'message-timestamp';
    timestampEl.textContent = formatTimestamp(timestamp || new Date().toISOString());
    
    header.appendChild(senderName);
    header.appendChild(timestampEl);
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Format message with markdown (existing functionality)
    const formattedText = formatMessage(message);
    messageContent.innerHTML = formattedText;
    
    contentWrapper.appendChild(header);
    contentWrapper.appendChild(messageContent);
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentWrapper);
    
    elements.chatMessages.appendChild(messageDiv);
    scrollToBottom();
  }

  function formatMessage(text) {
    // EXISTING FUNCTIONALITY: Parse markdown with marked.js
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false
      });
      
      return marked.parse(text);
    }
    
    // Fallback formatting
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }

  function addTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant-message typing';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'R';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content-wrapper';
    
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    
    contentWrapper.appendChild(typingIndicator);
    typingDiv.appendChild(avatar);
    typingDiv.appendChild(contentWrapper);
    
    elements.chatMessages.appendChild(typingDiv);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const typingIndicator = elements.chatMessages.querySelector('.typing');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  // ===================================
  // CONVERSATION LIST RENDERING
  // ===================================

  function renderConversationList(convos) {
    if (!convos || convos.length === 0) {
      showEmptyConversationState();
      return;
    }
    
    elements.conversationList.innerHTML = '';
    
    convos.forEach(conversation => {
      const item = document.createElement('div');
      item.className = 'conversation-item';
      if (conversation.id === currentConversationId) {
        item.classList.add('active');
      }
      
      const header = document.createElement('div');
      header.className = 'conversation-item-header';
      
      const title = document.createElement('div');
      title.className = 'conversation-item-title';
      title.textContent = conversation.title;
      
      const time = document.createElement('div');
      time.className = 'conversation-item-time';
      time.textContent = formatRelativeTime(conversation.updatedAt);
      
      header.appendChild(title);
      header.appendChild(time);
      
      const preview = document.createElement('div');
      preview.className = 'conversation-item-preview';
      preview.textContent = getConversationPreview(conversation);
      
      item.appendChild(header);
      item.appendChild(preview);
      
      item.addEventListener('click', () => {
        document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        loadConversation(conversation.id);
      });
      
      elements.conversationList.appendChild(item);
    });
  }

  function showEmptyConversationState() {
    elements.conversationList.innerHTML = `
      <div class="conversation-list-empty">
        <p>No conversations yet. Start a new chat to begin!</p>
      </div>
    `;
  }

  function handleConversationSearch(e) {
    const query = e.target.value.toLowerCase();
    
    if (!query) {
      renderConversationList(conversations);
      return;
    }
    
    const filtered = conversations.filter(conv => 
      conv.title.toLowerCase().includes(query) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(query))
    );
    
    renderConversationList(filtered);
  }

  // ===================================
  // UI STATE MANAGEMENT
  // ===================================

  function showWelcomeState() {
    elements.welcomeState.style.display = 'flex';
    elements.chatInterface.style.display = 'none';
  }

  function showChatInterface() {
    elements.welcomeState.style.display = 'none';
    elements.chatInterface.style.display = 'flex';
  }

  // ===================================
  // INPUT HANDLING
  // ===================================

  function handleInputResize() {
    elements.chatInput.style.height = 'auto';
    elements.chatInput.style.height = elements.chatInput.scrollHeight + 'px';
  }

  function handleInputKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  }

  // ===================================
  // INFO MODAL (Existing functionality)
  // ===================================

  function showInfoModal() {
    let sourcesHTML = "";
    if (window.lastSources && window.lastSources.length > 0) {
      sourcesHTML = "<h3 style='margin-top: 1rem;'>Last Query Sources:</h3>";
      window.lastSources.forEach((source) => {
        sourcesHTML += `
          <div style="margin: 0.75rem 0; padding: 0.75rem; background: #f9fafb; border-radius: 8px; border-left: 3px solid #71b871;">
            <div style="font-weight: 600; color: #1f2937; margin-bottom: 0.25rem;">${source.title}</div>
            <div style="font-size: 0.875rem; color: #6b7280;">Relevance: ${Math.round(source.similarity * 100)}%</div>
          </div>
        `;
      });
    }

    const modal = document.createElement("div");
    modal.id = "chatInfoModal";
    modal.className = "modal-wrapper wellness-info active";
    modal.innerHTML = `
      <div class="modal-background"></div>
      <div class="modal-card">
        <div class="modal-header">
          <a class="modal-return-button w-inline-block w--current" aria-current="page">
            {{> svg/backArrow}}
          </a>
          <h1 class="modal-button">About Reed</h1>
        </div>
        <div class="modal-description">
          <p>Reed is your health knowledge assistant powered by retrieval-augmented generation (RAG). Reed only provides information based on trusted health resources in our database.</p>
          <p>Unlike generic AI chatbots, Reed doesn't make things up - it will only answer with information it can find in reliable sources.</p>
          <p>Note that Reed is currently in early development with a limited knowledge base. We're using free embeddings and a lightweight model, which can often leave a disappointing response quality. As we expand our database and upgrade to premium services, you can expect significantly improved accuracy and more comprehensive answers.</p>
          ${sourcesHTML}
        </div>
        <div class="modal-footer">
          <a href="#" aria-current="page" class="cancel-button cancel-space">Close</a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector(".modal-background").addEventListener("click", () => modal.remove());
    modal.querySelector(".cancel-button").addEventListener("click", (e) => {
      e.preventDefault();
      modal.remove();
    });
    
    const returnBtn = modal.querySelector(".modal-return-button");
    if (returnBtn) {
      returnBtn.addEventListener("click", () => modal.remove());
    }
  }

  // ===================================
  // UTILITY FUNCTIONS
  // ===================================

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function generateConversationTitle(messages) {
    if (!messages || messages.length === 0) {
      return 'New conversation';
    }
    
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) {
      return 'New conversation';
    }
    
    // Take first 50 characters of first message as title
    let title = firstUserMessage.content.substring(0, 50);
    if (firstUserMessage.content.length > 50) {
      title += '...';
    }
    
    return title;
  }

  function getConversationPreview(conversation) {
    if (!conversation.messages || conversation.messages.length === 0) {
      return 'No messages';
    }
    
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    let preview = lastMessage.content.substring(0, 80);
    if (lastMessage.content.length > 80) {
      preview += '...';
    }
    
    return preview;
  }

  function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    return date.toLocaleDateString();
  }

  function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function scrollToBottom() {
    const wrapper = document.querySelector('.chat-messages-wrapper');
    if (wrapper) {
      wrapper.scrollTop = wrapper.scrollHeight;
    }
  }

  // ===================================
  // INITIALIZE ON PAGE LOAD
  // ===================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();