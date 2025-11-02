// src/db/routes/ragRoutes.js
const express = require("express");
const router = express.Router();
const medicalKnowledgeService = require("../medicalKnowledgeService");
const { connectToMongoDB, isConnected } = require("../../mongodb");
const mongoose = require("mongoose");

// Simple middleware for logging
router.use((req, res, next) => {
  console.log(`RAG API Request: ${req.method} ${req.path}`);
  next();
});

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "RAG API is working!" });
});

// Ask endpoint
router.post("/ask", async (req, res) => {
  try {
    const { query, userContext, conversationHistory } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log('🔍 RAG request received');
    console.log('🔍 Query:', query);
    console.log('🔍 User context provided:', !!userContext);
    console.log('💬 Conversation history length:', conversationHistory?.length || 0);
    console.log('🔍 Performing RAG with context:', !!userContext);

    let result;
    try {
      // Use context-aware RAG if userContext is provided
      result = userContext 
        ? await medicalKnowledgeService.performRagWithContext(query, userContext, conversationHistory)
        : await medicalKnowledgeService.performRag(query, conversationHistory);
      
      console.log('🔍 RAG service result:', result);
      console.log('🔍 Result type:', typeof result);
      console.log('🔍 Result has response property:', result && typeof result === 'object' && 'response' in result);
    } catch (serviceError) {
      console.error('🚨 Medical knowledge service error:', serviceError);
      throw serviceError;
    }

    if (!result) {
      console.error('🚨 RAG service returned null/undefined result');
      return res.status(500).json({ 
        error: "RAG service returned empty result",
        debug: "The medical knowledge service returned null or undefined"
      });
    }

    if (typeof result !== 'object') {
      console.error('🚨 RAG service returned non-object result:', typeof result);
      return res.status(500).json({ 
        error: "RAG service returned invalid result type",
        debug: `Expected object, got ${typeof result}`
      });
    }

    if (!('response' in result)) {
      console.error('🚨 RAG service result missing response property:', Object.keys(result));
      return res.status(500).json({ 
        error: "RAG service result missing response property",
        debug: `Available properties: ${Object.keys(result).join(', ')}`
      });
    }

    const responseData = {
      response: result.response || "No response generated",
      sources: result.sources || [],
      contextUsed: !!userContext
    };

    console.log('✅ Successfully sending response:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error("🚨 Error in /ask endpoint:", error);
    console.error("🚨 Error stack:", error.stack);
    
    res.status(500).json({ 
      error: "Failed to process query",
      message: error.message,
      type: error.constructor.name,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ===================================
// CONVERSATIONS ENDPOINT (NEW!)
// ===================================

// Helper function to get or create Conversation model
function getConversationModel() {
  if (mongoose.models.Conversation) {
    return mongoose.models.Conversation;
  }

  const conversationSchema = new mongoose.Schema({
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: true,
      index: true 
    },
    title: { 
      type: String, 
      required: true 
    },
    messages: [{
      role: { 
        type: String, 
        enum: ['user', 'assistant', 'system'],
        required: true 
      },
      content: { 
        type: String, 
        required: true 
      },
      timestamp: { 
        type: Date, 
        default: Date.now 
      }
    }],
    createdAt: { 
      type: Date, 
      default: Date.now,
      index: true 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now,
      index: true 
    }
  }, {
    collection: 'conversations'
  });

  return mongoose.model('Conversation', conversationSchema);
}

// Conversations endpoint - handles list, save, and delete operations
router.post("/conversations", async (req, res) => {
  try {
    const { operation } = req.body;

    if (!operation) {
      return res.status(400).json({
        error: 'Missing operation',
        message: 'Request body must include an "operation" field (list, save, or delete)'
      });
    }

    // Ensure MongoDB connection
    if (!isConnected()) {
      console.log('🔄 Establishing MongoDB connection...');
      await connectToMongoDB();
    }

    // Route to appropriate handler
    switch (operation) {
      case 'list':
        return await handleListConversations(req, res);
      case 'save':
        return await handleSaveConversation(req, res);
      case 'delete':
        return await handleDeleteConversation(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid operation',
          message: 'Operation must be "list", "save", or "delete"'
        });
    }

  } catch (error) {
    console.error('❌ Conversations endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// LIST conversations
async function handleListConversations(req, res) {
  console.log('🔍 LIST CONVERSATIONS');
  
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing userId', 
      message: 'userId is required for list operation'
    });
  }

  try {
    const Conversation = getConversationModel();

    console.log('📥 Fetching conversations for user:', userId);
    
    const conversations = await Conversation
      .find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('_id title messages updatedAt createdAt')
      .lean();
    
    console.log(`✅ Found ${conversations.length} conversations`);
    
    const formattedConversations = conversations.map(conv => ({
      id: conv._id.toString(),
      title: conv.title,
      messages: conv.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      })),
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt
    }));

    return res.status(200).json({
      success: true,
      conversations: formattedConversations,
      count: formattedConversations.length
    });

  } catch (error) {
    console.error('❌ List conversations error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations',
      details: error.message
    });
  }
}

// SAVE conversation
async function handleSaveConversation(req, res) {
  console.log('💾 SAVE CONVERSATION');
  
  const { id, userId, title, messages } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing userId', 
      message: 'userId is required for save operation'
    });
  }
  
  if (!title) {
    return res.status(400).json({ 
      error: 'Missing title', 
      message: 'title is required for save operation'
    });
  }
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ 
      error: 'Invalid messages', 
      message: 'messages must be an array'
    });
  }

  try {
    const Conversation = getConversationModel();

    let conversation;
    
    if (id) {
      // Update existing conversation
      console.log('📝 Updating existing conversation:', id);
      
      conversation = await Conversation.findOneAndUpdate(
        { 
          _id: new mongoose.Types.ObjectId(id), 
          userId: new mongoose.Types.ObjectId(userId)
        },
        { 
          title, 
          messages,
          updatedAt: new Date() 
        },
        { 
          new: true,
          runValidators: true 
        }
      );
      
      if (!conversation) {
        return res.status(404).json({
          error: 'Conversation not found',
          message: 'The conversation does not exist or you do not have permission to update it'
        });
      }
      
      console.log('✅ Conversation updated successfully');
      
    } else {
      // Create new conversation
      console.log('📝 Creating new conversation');
      
      conversation = await Conversation.create({
        userId: new mongoose.Types.ObjectId(userId),
        title,
        messages,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✅ Conversation created successfully:', conversation._id);
    }

    return res.status(200).json({
      success: true,
      conversationId: conversation._id.toString(),
      conversation: {
        id: conversation._id.toString(),
        title: conversation.title,
        messages: conversation.messages,
        updatedAt: conversation.updatedAt,
        createdAt: conversation.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Save conversation error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.message
      });
    }
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        details: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to save conversation',
      details: error.message
    });
  }
}

// DELETE conversation
async function handleDeleteConversation(req, res) {
  console.log('🗑️ DELETE CONVERSATION');
  
  const { conversationId, userId } = req.body;
  
  if (!conversationId) {
    return res.status(400).json({ 
      error: 'Missing conversationId', 
      message: 'conversationId is required for delete operation'
    });
  }
  
  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing userId', 
      message: 'userId is required for delete operation'
    });
  }

  try {
    const Conversation = getConversationModel();

    console.log('🗑️ Attempting to delete conversation:', conversationId);
    
    const result = await Conversation.deleteOne({ 
      _id: new mongoose.Types.ObjectId(conversationId),
      userId: new mongoose.Types.ObjectId(userId)
    });
    
    if (result.deletedCount === 0) {
      console.log('❌ Conversation not found or permission denied');
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
        message: 'The conversation does not exist or you do not have permission to delete it'
      });
    }
    
    console.log('✅ Conversation deleted successfully');

    return res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully',
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('❌ Delete conversation error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        details: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
      details: error.message
    });
  }
}

module.exports = router;