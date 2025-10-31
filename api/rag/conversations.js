// api/rag/conversations.js
// Combined API endpoint for all conversation operations (list, save, delete)

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    // Determine operation from request body
    const { operation } = req.body;
    
    if (!operation) {
      return res.status(400).json({
        error: 'Missing operation',
        message: 'Request body must include an "operation" field (list, save, or delete)'
      });
    }

    // Route to appropriate handler
    switch (operation) {
      case 'list':
        return await handleList(req, res);
      case 'save':
        return await handleSave(req, res);
      case 'delete':
        return await handleDelete(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid operation',
          message: 'Operation must be "list", "save", or "delete"'
        });
    }

  } catch (error) {
    console.error('❌ Conversations API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

// ===================================
// HELPER: Connect to MongoDB
// ===================================

async function connectToDatabase() {
  let connectToMongoDB, isConnected, mongoose;
  
  try {
    const mongoModule = await import('../../src/mongodb.js');
    connectToMongoDB = mongoModule.connectToMongoDB;
    isConnected = mongoModule.isConnected;
    mongoose = mongoModule.default || mongoModule.mongoose;
    console.log('📊 MongoDB module imported successfully');
  } catch (importError) {
    console.error('❌ MongoDB import failed:', importError);
    throw new Error('Unable to load database module');
  }

  // Ensure connection
  try {
    if (!isConnected()) {
      console.log('🔄 Establishing MongoDB connection...');
      await Promise.race([
        connectToMongoDB(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 8000)
        )
      ]);
    }
    console.log('✅ MongoDB connection verified');
  } catch (connectionError) {
    console.error('❌ MongoDB connection failed:', connectionError.message);
    throw new Error('Unable to connect to database');
  }

  return mongoose;
}

// ===================================
// HELPER: Get or Create Conversation Model
// ===================================

function getConversationModel(mongoose) {
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

// ===================================
// OPERATION: LIST CONVERSATIONS
// ===================================

async function handleList(req, res) {
  console.log('🔍 LIST CONVERSATIONS');
  
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ 
      error: 'Missing userId', 
      message: 'userId is required for list operation'
    });
  }

  try {
    const mongoose = await connectToDatabase();
    const Conversation = getConversationModel(mongoose);

    console.log('📥 Fetching conversations for user:', userId);
    
    const conversations = await Conversation
      .find({ userId: mongoose.Types.ObjectId(userId) })
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

// ===================================
// OPERATION: SAVE CONVERSATION
// ===================================

async function handleSave(req, res) {
  console.log('💾 SAVE CONVERSATION');
  
  const { id, userId, title, messages } = req.body;
  
  // Validate required fields
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
    const mongoose = await connectToDatabase();
    const Conversation = getConversationModel(mongoose);

    let conversation;
    
    if (id) {
      // Update existing conversation
      console.log('📝 Updating existing conversation:', id);
      
      conversation = await Conversation.findOneAndUpdate(
        { 
          _id: mongoose.Types.ObjectId(id), 
          userId: mongoose.Types.ObjectId(userId) 
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
        userId: mongoose.Types.ObjectId(userId),
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
    
    // Handle specific MongoDB errors
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

// ===================================
// OPERATION: DELETE CONVERSATION
// ===================================

async function handleDelete(req, res) {
  console.log('🗑️ DELETE CONVERSATION');
  
  const { conversationId, userId } = req.body;
  
  // Validate required fields
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
    const mongoose = await connectToDatabase();
    const Conversation = getConversationModel(mongoose);

    console.log('🗑️ Attempting to delete conversation:', conversationId);
    
    const result = await Conversation.deleteOne({ 
      _id: mongoose.Types.ObjectId(conversationId),
      userId: mongoose.Types.ObjectId(userId)
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
    
    // Handle specific MongoDB errors
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
