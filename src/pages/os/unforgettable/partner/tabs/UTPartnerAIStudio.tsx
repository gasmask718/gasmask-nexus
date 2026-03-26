import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Wand2, FileText, Tag, Image, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { partnerId: string; category: string; }

const AI_TOOLS = [
  { id: 'description', label: 'Write Listing Description', icon: FileText, prompt: 'Write a compelling marketplace listing description for: ' },
  { id: 'title', label: 'Generate Title', icon: Wand2, prompt: 'Generate a catchy marketplace listing title for: ' },
  { id: 'tags', label: 'Suggest Tags', icon: Tag, prompt: 'Suggest relevant search tags for this event service: ' },
  { id: 'pricing', label: 'Pricing Copy', icon: DollarSign, prompt: 'Write pricing copy that sells for: ' },
  { id: 'seo', label: 'SEO Keywords', icon: Sparkles, prompt: 'Generate SEO keywords for: ' },
  { id: 'upsell', label: 'Suggest Upsells', icon: Sparkles, prompt: 'Suggest add-on upsells for: ' },
];

export default function UTPartnerAIStudio({ partnerId, category }: Props) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const runAI = async (toolId: string) => {
    if (!input.trim()) { toast.error('Enter a description first'); return; }
    const tool = AI_TOOLS.find(t => t.id === toolId);
    if (!tool) return;
    
    setLoading(true);
    setActiveTool(toolId);
    setOutput('');

    try {
      const { data, error } = await supabase.functions.invoke('ut-partner-ai', {
        body: { 
          prompt: tool.prompt + input, 
          category, 
          tool: toolId,
          partner_id: partnerId 
        }
      });
      if (error) throw error;
      setOutput(data?.result || 'No result generated');
    } catch (e: any) {
      toast.error(e.message || 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> AI Studio
        </h3>
        <p className="text-xs text-muted-foreground mt-1">AI tools to help create and optimize your marketplace presence</p>
      </div>

      {/* AI Tools Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {AI_TOOLS.map(tool => (
          <Card 
            key={tool.id} 
            className={`cursor-pointer transition-all hover:border-primary/50 ${activeTool === tool.id ? 'border-primary ring-1 ring-primary/20' : 'border-border/50'}`}
            onClick={() => runAI(tool.id)}
          >
            <CardContent className="pt-4 pb-3 text-center">
              <tool.icon className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-xs font-medium">{tool.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Input */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Describe your service / listing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            rows={3} 
            placeholder="e.g. We offer a 5000 sq ft ballroom with crystal chandeliers, perfect for weddings and galas..."
          />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{category}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Output */}
      {(output || loading) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              AI Output
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Generating...</div>
            ) : (
              <div className="text-sm whitespace-pre-wrap">{output}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
