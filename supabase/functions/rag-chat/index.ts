// supabase/functions/rag-chat/index.ts
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  query: string;
  userContext?: any;
  options?: any;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `OpenAI API error: ${error.error?.message || response.status}`,
    );
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function generateChatResponse(messages: any[]): Promise<string> {
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `OpenAI API error: ${error.error?.message || response.status}`,
    );
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { query, userContext, options = {} }: RequestBody = await req.json();

    console.log("Edge Function - Query:", query);
    console.log("Edge Function - User context provided:", !!userContext);

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Handle personal queries
    if (
      query.toLowerCase().includes("my blood type") &&
      userContext?.profile?.bloodType
    ) {
      const bloodType = userContext.profile.bloodType;
      if (bloodType && bloodType !== "Unknown") {
        return new Response(
          JSON.stringify({
            success: true,
            response:
              `According to your profile, your blood type is ${bloodType}.`,
            sources: [],
            service: "supabase-edge",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Generate embedding for the query
    console.log("Generating embedding...");
    const queryEmbedding = await generateEmbedding(query);

    // Search for similar documents using pgvector
    console.log("Searching for similar documents...");
    const { data: documents, error } = await supabase.rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 5,
    });

    if (error) {
      console.error("Database search error:", error);
      throw new Error(`Database search failed: ${error.message}`);
    }

    if (!documents || documents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          response:
            "I don't have specific information about that topic in my medical knowledge base. Please try rephrasing your question or ask about cardiovascular health, cholesterol, or other health topics I might be able to help with.",
          sources: [],
          service: "supabase-edge",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create context from documents
    const context = documents
      .map((doc: any) => `Source: ${doc.title}\n${doc.content}`)
      .join("\n\n");

    // Enhance query with user context if available
    let contextualQuery = query;
    if (userContext?.profile) {
      const { age, sex, familyHistoryDetails } = userContext.profile;
      const contextParts = [];

      if (age && sex) {
        contextParts.push(`Patient is a ${age} year old ${sex.toLowerCase()}`);
      }

      if (familyHistoryDetails && familyHistoryDetails.length > 0) {
        const conditions = familyHistoryDetails.map((fh: any) => fh.condition)
          .join(", ");
        contextParts.push(`Family history includes: ${conditions}`);
      }

      if (contextParts.length > 0) {
        contextualQuery = `${contextParts.join(". ")}. Question: ${query}`;
      }
    }

    // Generate response using OpenAI
    console.log("Generating chat response...");
    const messages = [
      {
        role: "system",
        content:
          `You are a knowledgeable health assistant. Use the provided medical information to answer questions accurately. Always mention that you're not a doctor and users should consult healthcare professionals for medical advice.

Context from medical documents:
${context}`,
      },
      {
        role: "user",
        content: contextualQuery,
      },
    ];

    const response = await generateChatResponse(messages);

    return new Response(
      JSON.stringify({
        success: true,
        response,
        sources: documents.map((doc: any) => ({
          title: doc.title,
          source: doc.source || "Medical Literature",
          similarity: doc.similarity,
        })),
        contextUsed: !!userContext,
        service: "supabase-edge",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Edge Function error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
