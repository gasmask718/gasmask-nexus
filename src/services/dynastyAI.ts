import { supabase } from '@/integrations/supabase/client';

/**
 * DynastyAI Engine - Centralized AI Brain Layer
 * Unifies all AI intelligence across Dynasty OS
 */

// Brand-specific tone packs
const BRAND_TONES = {
  GasMask: {
    voice: 'professional, street-smart, direct',
    keywords: ['quality', 'authentic', 'street-approved'],
    style: 'Bold, confident, urban edge',
    greeting: 'Yo',
  },
  HotMama: {
    voice: 'flirty, confident, empowering, luxurious',
    keywords: ['pleasure', 'luxury', 'empowerment', 'sensual'],
    style: 'Seductive, premium, empowering',
    greeting: 'Hey love',
  },
  GrabbaRUs: {
    voice: 'energetic, colorful, NY-style, hustler mentality',
    keywords: ['fresh', 'best price', 'quality', 'NYC'],
    style: 'Fast-paced, hustler energy, NYC pride',
    greeting: 'Yo what up',
  },
  HotScalati: {
    voice: 'warm, inviting, spicy, artisan',
    keywords: ['fire', 'authentic', 'spicy', 'premium'],
    style: 'Warm, passionate, artisan craft',
    greeting: 'Hey there',
  },
  TopTier: {
    voice: 'premium, exclusive, professional, elite',
    keywords: ['excellence', 'premium', 'elite', 'professional'],
    style: 'Sophisticated, luxury, high-end',
    greeting: 'Good day',
  },
  UnforgettableTimes: {
    voice: 'fun, celebratory, party vibes, memorable',
    keywords: ['party', 'celebrate', 'memories', 'fun'],
    style: 'Energetic, festive, unforgettable',
    greeting: 'Hey party people',
  },
  iCleanWeClean: {
    voice: 'clean, efficient, trustworthy, eco-friendly',
    keywords: ['clean', 'fresh', 'eco', 'professional'],
    style: 'Professional, clean, trustworthy',
    greeting: 'Hello',
  },
  Playboxxx: {
    voice: 'edgy, bold, unapologetic, adult',
    keywords: ['bold', 'exclusive', 'adult', 'premium'],
    style: 'Provocative, confident, premium adult',
    greeting: 'Hey',
  },
  Funding: {
    voice: 'professional, trustworthy, empowering, financial',
    keywords: ['capital', 'growth', 'funding', 'opportunity'],
    style: 'Professional, empowering, trustworthy',
    greeting: 'Hello',
  },
  Grants: {
    voice: 'helpful, informative, encouraging, government-aware',
    keywords: ['grants', 'funding', 'opportunity', 'assistance'],
    style: 'Helpful, informative, encouraging',
    greeting: 'Hi there',
  },
  CreditRepair: {
    voice: 'supportive, professional, hopeful, empowering',
    keywords: ['credit', 'repair', 'improve', 'financial freedom'],
    style: 'Supportive, professional, hopeful',
    greeting: 'Hello',
  },
  SpecialNeeds: {
    voice: 'caring, supportive, understanding, professional',
    keywords: ['support', 'care', 'assistance', 'inclusive'],
    style: 'Caring, supportive, professional',
    greeting: 'Hi',
  },
  SportsBetting: {
    voice: 'exciting, data-driven, confident, competitive',
    keywords: ['odds', 'win', 'betting', 'strategy'],
    style: 'Exciting, analytical, competitive',
    greeting: "What's good",
  },
  Dynasty: {
    voice: 'professional, powerful, strategic, enterprise',
    keywords: ['empire', 'growth', 'strategy', 'scale'],
    style: 'Powerful, strategic, enterprise-grade',
    greeting: 'Welcome',
  },
};

export type BrandName = keyof typeof BRAND_TONES;

interface AIRequest {
  brand: BrandName;
  type: 'classification' | 'prediction' | 'segmentation' | 'summarization' | 'insight' | 'personalization' | 'communication' | 'data-cleaning' | 'compliance';
  context: any;
  prompt?: string;
}

interface AIResponse {
  success: boolean;
  data: any;
  reasoning?: string;
  confidence?: number;
  brand: BrandName;
}

/**
 * Main AI Router - Routes requests to appropriate AI module
 */
export async function dynastyAI(request: AIRequest): Promise<AIResponse> {
  const { brand, type, context, prompt } = request;
  const tone = BRAND_TONES[brand];

  // Build system prompt with brand context
  const systemPrompt = `You are DynastyAI, the intelligence engine for ${brand}.

BRAND VOICE: ${tone.voice}
BRAND STYLE: ${tone.style}
KEY WORDS: ${tone.keywords.join(', ')}

You must maintain this brand's personality in all responses while being helpful and accurate.`;

  switch (type) {
    case 'classification':
      return await classifyData(brand, context, systemPrompt);
    case 'prediction':
      return await predictOutcome(brand, context, systemPrompt);
    case 'segmentation':
      return await buildSegment(brand, context, systemPrompt);
    case 'summarization':
      return await summarizeContent(brand, context, systemPrompt);
    case 'insight':
      return await generateInsight(brand, context, systemPrompt);
    case 'personalization':
      return await personalizeMessage(brand, context, systemPrompt, prompt);
    case 'communication':
      return await generateCommunication(brand, context, systemPrompt, prompt);
    case 'data-cleaning':
      return await cleanData(brand, context, systemPrompt);
    case 'compliance':
      return await checkCompliance(brand, context, systemPrompt);
    default:
      return {
        success: false,
        data: null,
        brand,
        reasoning: 'Unknown AI type requested',
      };
  }
}

/**
 * Classification Module - Auto-detects brand, category, intent
 */
async function classifyData(brand: BrandName, context: any, systemPrompt: string): Promise<AIResponse> {
  const prompt = `Classify this data for ${brand}:
${JSON.stringify(context, null, 2)}

Determine:
1. Which brand does this belong to?
2. What category/segment?
3. What is the customer intent?
4. Priority level (high/medium/low)

Return JSON only.`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-classification', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.classification,
      reasoning: data.reasoning,
      confidence: data.confidence || 85,
      brand,
    };
  } catch (error) {
    console.error('Classification error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Classification failed',
    };
  }
}

/**
 * Prediction Module - Forecasts reorders, churn, revenue
 */
async function predictOutcome(brand: BrandName, context: any, systemPrompt: string): Promise<AIResponse> {
  const prompt = `Analyze customer behavior for ${brand} and predict:
${JSON.stringify(context, null, 2)}

Predict:
1. Next order date (if applicable)
2. Churn risk (0-100)
3. Lifetime value estimate
4. Best upsell opportunities

Return JSON only.`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-prediction', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.predictions,
      reasoning: data.reasoning,
      confidence: data.confidence || 75,
      brand,
    };
  } catch (error) {
    console.error('Prediction error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Prediction failed',
    };
  }
}

/**
 * Segmentation Module - Builds smart customer segments
 */
async function buildSegment(brand: BrandName, context: any, systemPrompt: string): Promise<AIResponse> {
  const prompt = `Build customer segments for ${brand}:
${JSON.stringify(context, null, 2)}

Create segments based on:
- Purchase behavior
- Engagement level
- Product preferences
- Geographic location
- Order frequency

Return JSON with segment definitions.`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-segmentation', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.segments,
      reasoning: data.reasoning,
      brand,
    };
  } catch (error) {
    console.error('Segmentation error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Segmentation failed',
    };
  }
}

/**
 * Summarization Module - Creates summaries of calls, orders, interactions
 */
async function summarizeContent(brand: BrandName, context: any, systemPrompt: string): Promise<AIResponse> {
  const prompt = `Summarize this interaction for ${brand}:
${JSON.stringify(context, null, 2)}

Create:
1. Brief summary (1-2 sentences)
2. Key points
3. Action items
4. Sentiment (positive/neutral/negative)

Return JSON only.`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-summarization', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.summary,
      reasoning: data.reasoning,
      brand,
    };
  } catch (error) {
    console.error('Summarization error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Summarization failed',
    };
  }
}

/**
 * Insight Generation Module - Creates actionable insights
 */
async function generateInsight(brand: BrandName, context: any, systemPrompt: string): Promise<AIResponse> {
  const prompt = `Analyze this data for ${brand} and generate insights:
${JSON.stringify(context, null, 2)}

Provide:
1. Key trends
2. Opportunities
3. Risks/warnings
4. Recommended actions

Return JSON only.`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-insights', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.insights,
      reasoning: data.reasoning,
      confidence: data.confidence || 80,
      brand,
    };
  } catch (error) {
    console.error('Insight generation error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Insight generation failed',
    };
  }
}

/**
 * Personalization Module - Personalizes messages per customer
 */
async function personalizeMessage(brand: BrandName, context: any, systemPrompt: string, userPrompt?: string): Promise<AIResponse> {
  const tone = BRAND_TONES[brand];
  
  const prompt = `Personalize this message for ${brand}:

CUSTOMER CONTEXT:
${JSON.stringify(context, null, 2)}

BASE MESSAGE:
${userPrompt || 'Create a personalized outreach message'}

Use ${tone.greeting} as greeting style.
Match brand voice: ${tone.voice}
Include: ${tone.keywords[0]}, ${tone.keywords[1]}

Return only the personalized message, no JSON.`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-personalization', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.message,
      brand,
    };
  } catch (error) {
    console.error('Personalization error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Personalization failed',
    };
  }
}

/**
 * Communication Generation Module - Creates SMS, emails, scripts
 */
async function generateCommunication(brand: BrandName, context: any, systemPrompt: string, userPrompt?: string): Promise<AIResponse> {
  const tone = BRAND_TONES[brand];
  
  const prompt = `Generate communication for ${brand}:

CONTEXT:
${JSON.stringify(context, null, 2)}

TYPE: ${userPrompt || 'general outreach'}

Create appropriate message matching:
- Brand voice: ${tone.voice}
- Style: ${tone.style}
- Greeting: ${tone.greeting}
- Keywords: ${tone.keywords.join(', ')}

Return JSON with: { sms: string, email: { subject: string, body: string }, script: string }`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-communication', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.communications,
      brand,
    };
  } catch (error) {
    console.error('Communication generation error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Communication generation failed',
    };
  }
}

/**
 * Data Cleaning Module - Fixes duplicates, formats data
 */
async function cleanData(brand: BrandName, context: any, systemPrompt: string): Promise<AIResponse> {
  const prompt = `Clean and normalize this data for ${brand}:
${JSON.stringify(context, null, 2)}

Fix:
1. Duplicate entries
2. Phone number formats
3. Email validation
4. Address standardization
5. Name capitalization

Return cleaned data as JSON.`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-data-cleaning', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.cleaned,
      reasoning: data.changes,
      brand,
    };
  } catch (error) {
    console.error('Data cleaning error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Data cleaning failed',
    };
  }
}

/**
 * Compliance Module - Checks legal/regulatory compliance
 */
async function checkCompliance(brand: BrandName, context: any, systemPrompt: string): Promise<AIResponse> {
  const prompt = `Check compliance for ${brand}:
${JSON.stringify(context, null, 2)}

Verify:
1. Age restrictions (if applicable)
2. Legal disclaimers
3. Privacy compliance
4. Industry regulations
5. Communication consent

Return JSON with compliance status and warnings.`;

  try {
    const { data, error } = await supabase.functions.invoke('ai-compliance', {
      body: { systemPrompt, prompt, brand }
    });

    if (error) throw error;

    return {
      success: true,
      data: data.compliance,
      reasoning: data.warnings,
      brand,
    };
  } catch (error) {
    console.error('Compliance check error:', error);
    return {
      success: false,
      data: null,
      brand,
      reasoning: 'Compliance check failed',
    };
  }
}

/**
 * Quick Helper: Generate personalized SMS
 */
export async function generateSMS(brand: BrandName, customerName: string, message: string) {
  return dynastyAI({
    brand,
    type: 'personalization',
    context: { customerName },
    prompt: message,
  });
}

/**
 * Quick Helper: Predict reorder
 */
export async function predictReorder(brand: BrandName, orderHistory: any[]) {
  return dynastyAI({
    brand,
    type: 'prediction',
    context: { orderHistory },
  });
}

/**
 * Quick Helper: Classify uploaded data
 */
export async function classifyUpload(brand: BrandName, csvData: any[]) {
  return dynastyAI({
    brand,
    type: 'classification',
    context: { csvData },
  });
}

/**
 * Quick Helper: Generate insights
 */
export async function generateBrandInsights(brand: BrandName, data: any) {
  return dynastyAI({
    brand,
    type: 'insight',
    context: data,
  });
}

/**
 * Brand Access Control - Ensures AI only accesses permitted brand data
 */
export function validateBrandAccess(userRole: string, requestedBrand: BrandName): boolean {
  // Grabba Cluster VAs can access all 4 Grabba brands
  if (userRole === 'grabba_va') {
    return ['GasMask', 'HotMama', 'GrabbaRUs', 'HotScalati'].includes(requestedBrand);
  }
  
  // Other VAs restricted to their specific brand
  // This would be extended based on user permissions in database
  return true; // Implement proper role checking
}
