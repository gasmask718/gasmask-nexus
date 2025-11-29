import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIWorker {
  id: string;
  worker_name: string;
  worker_role: string;
  worker_department: string;
  description: string;
  kpi_metrics: any;
  memory: any;
  status: string;
  experience_points: number;
  tasks_completed: number;
}

interface WorkTask {
  id: string;
  task_title: string;
  task_details: string;
  assigned_to_worker_id: string | null;
  status: string;
  priority: string;
  department: string;
  input_data: any;
}

// Task routing logic - maps keywords to departments and roles
const routingRules: { keywords: string[]; department: string; role: string }[] = [
  { keywords: ['crm', 'customer', 'contact', 'relationship', 'store list'], department: 'Sales/CRM', role: 'AI CRM Agent' },
  { keywords: ['store check', 'inactive store', 'store activity', 'visit'], department: 'Sales/CRM', role: 'AI Store Checker' },
  { keywords: ['follow up', 'follow-up', 'reminder', 're-engage', 'cold store'], department: 'Sales/CRM', role: 'AI Follow-Up Agent' },
  { keywords: ['deal', 'close', 'hot lead', 'opportunity', 'sales'], department: 'Sales/CRM', role: 'AI Deal Closer' },
  { keywords: ['route', 'delivery route', 'optimize', 'driver', 'logistics'], department: 'Operations', role: 'AI Route Assistant' },
  { keywords: ['inventory', 'stock', 'reorder', 'supply'], department: 'Operations', role: 'AI Inventory Controller' },
  { keywords: ['production', 'manufacture', 'schedule', 'output', 'tubes', 'boxes'], department: 'Operations', role: 'AI Production Supervisor' },
  { keywords: ['delivery', 'shipment', 'dispatch', 'tracking'], department: 'Operations', role: 'AI Delivery Supervisor' },
  { keywords: ['wholesale', 'bulk', 'partner order'], department: 'Wholesale', role: 'AI Wholesale Manager' },
  { keywords: ['acquisition', 'new store', 'prospect', 'market research'], department: 'Wholesale', role: 'AI Store Acquisition Agent' },
  { keywords: ['partner success', 'satisfaction', 'retention'], department: 'Wholesale', role: 'AI Partner Success Agent' },
  { keywords: ['account', 'profit', 'revenue', 'financial', 'calculate', 'report'], department: 'Finance', role: 'AI Accountant' },
  { keywords: ['payroll', 'salary', 'wage', 'compensation', 'hours'], department: 'Finance', role: 'AI Payroll Manager' },
  { keywords: ['expense', 'spending', 'budget', 'cost', 'savings', 'subscription'], department: 'Finance', role: 'AI Expense Analyzer' },
  { keywords: ['risk', 'threat', 'danger', 'warning', 'alert'], department: 'Intelligence', role: 'AI Risk Officer' },
  { keywords: ['insight', 'analysis', 'trend', 'pattern', 'data'], department: 'Intelligence', role: 'AI Insights Analyst' },
  { keywords: ['forecast', 'predict', 'future', 'projection'], department: 'Intelligence', role: 'AI Trend Forecaster' },
  { keywords: ['briefing', 'executive', 'summary', 'overview'], department: 'Global OS', role: 'AI Executive Assistant' },
  { keywords: ['system', 'health', 'monitor', 'workforce', 'ai worker'], department: 'Global OS', role: 'AI Dynasty Guardian' },
  { keywords: ['strategy', 'plan', 'coordinate', 'improve', 'optimize operations'], department: 'Global OS', role: 'AI COO Assistant' },
];

function findBestWorker(task: WorkTask, workers: AIWorker[]): AIWorker | null {
  const taskText = `${task.task_title} ${task.task_details || ''}`.toLowerCase();
  
  // Find matching rule
  for (const rule of routingRules) {
    if (rule.keywords.some(kw => taskText.includes(kw))) {
      const matchingWorker = workers.find(
        w => w.worker_role === rule.role && w.status === 'active'
      );
      if (matchingWorker) return matchingWorker;
    }
  }
  
  // If department specified, find any available worker in that department
  if (task.department) {
    const deptWorker = workers.find(
      w => w.worker_department === task.department && w.status === 'active'
    );
    if (deptWorker) return deptWorker;
  }
  
  // Default to Executive Assistant for unmatched tasks
  return workers.find(w => w.worker_role === 'AI Executive Assistant' && w.status === 'active') || null;
}

async function executeTask(supabase: any, task: WorkTask, worker: AIWorker): Promise<{ success: boolean; output: any }> {
  console.log(`Worker ${worker.worker_name} executing task: ${task.task_title}`);
  
  // Build context based on worker role
  let contextData: any = {};
  
  try {
    // Gather relevant data based on worker department
    if (worker.worker_department === 'Finance') {
      const [expenses, revenue] = await Promise.all([
        supabase.from('business_expenses').select('*').limit(50),
        supabase.from('business_transactions').select('*').eq('transaction_type', 'income').limit(50),
      ]);
      contextData = { expenses: expenses.data, revenue: revenue.data };
    } else if (worker.worker_department === 'Sales/CRM') {
      const [stores, followUps] = await Promise.all([
        supabase.from('store_master').select('*').limit(100),
        supabase.from('ai_follow_up_log').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      contextData = { stores: stores.data, followUps: followUps.data };
    } else if (worker.worker_department === 'Operations') {
      const [routes, inventory] = await Promise.all([
        supabase.from('routes').select('*').limit(50),
        supabase.from('inventory').select('*').limit(100),
      ]);
      contextData = { routes: routes.data, inventory: inventory.data };
    } else if (worker.worker_department === 'Intelligence') {
      const [risks, insights] = await Promise.all([
        supabase.from('ai_risk_insights').select('*').eq('status', 'open').limit(50),
        supabase.from('financial_ai_insights').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      contextData = { risks: risks.data, insights: insights.data };
    }

    // Call AI to process the task
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are ${worker.worker_name}, an AI ${worker.worker_role} in the ${worker.worker_department} department.
Your job: ${worker.description}
KPIs: ${JSON.stringify(worker.kpi_metrics)}
Memory: ${JSON.stringify(worker.memory || {})}

You must complete the assigned task and return a JSON response with:
{
  "summary": "Brief summary of what you did",
  "findings": ["Key finding 1", "Key finding 2"],
  "actions_taken": ["Action 1", "Action 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "data_updates": [], // Any suggested database updates
  "subtasks": [], // Any subtasks that should be created
  "success": true/false
}

Be concise, actionable, and data-driven.`
          },
          {
            role: 'user',
            content: `Task: ${task.task_title}
Details: ${task.task_details || 'No additional details'}
Priority: ${task.priority}
Input Data: ${JSON.stringify(task.input_data || {})}
Context Data: ${JSON.stringify(contextData)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    // Parse AI response
    let output: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      output = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content, success: true };
    } catch {
      output = { summary: content, success: true };
    }

    // Create subtasks if any
    if (output.subtasks && output.subtasks.length > 0) {
      for (const subtask of output.subtasks) {
        await supabase.from('ai_work_tasks').insert({
          task_title: subtask.title || subtask,
          task_details: subtask.details || '',
          parent_task_id: task.id,
          priority: task.priority,
          status: 'pending',
        });
      }
    }

    return { success: true, output };
  } catch (error) {
    console.error('Task execution error:', error);
    return { 
      success: false, 
      output: { error: error instanceof Error ? error.message : String(error) }
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'process'; // 'process' | 'create_task' | 'status'

    if (mode === 'create_task') {
      // Create a new task from user command
      const { command, priority = 'medium', userId } = body;
      
      const { data: task, error } = await supabase
        .from('ai_work_tasks')
        .insert({
          task_title: command,
          task_details: body.details || '',
          priority,
          created_by: userId,
          input_data: body.inputData || {},
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, task }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all workers
    const { data: workers, error: workersError } = await supabase
      .from('ai_workers')
      .select('*');

    if (workersError) throw workersError;

    // Get pending/unassigned tasks
    const { data: pendingTasks, error: tasksError } = await supabase
      .from('ai_work_tasks')
      .select('*')
      .or('status.eq.pending,and(status.eq.processing,started_at.lt.' + new Date(Date.now() - 5 * 60 * 1000).toISOString() + ')')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (tasksError) throw tasksError;

    const results: any[] = [];

    for (const task of pendingTasks || []) {
      // Assign worker if not assigned
      let assignedWorker: AIWorker | null = null;
      
      if (!task.assigned_to_worker_id) {
        assignedWorker = findBestWorker(task, workers || []);
        
        if (assignedWorker) {
          await supabase
            .from('ai_work_tasks')
            .update({
              assigned_to_worker_id: assignedWorker.id,
              auto_assigned: true,
              status: 'processing',
              started_at: new Date().toISOString(),
            })
            .eq('id', task.id);

          // Update worker status
          await supabase
            .from('ai_workers')
            .update({ status: 'busy' })
            .eq('id', assignedWorker.id);
        }
      } else {
        assignedWorker = workers?.find(w => w.id === task.assigned_to_worker_id) || null;
      }

      if (!assignedWorker) {
        results.push({ task_id: task.id, status: 'no_worker_available' });
        continue;
      }

      // Execute the task
      const { success, output } = await executeTask(supabase, task, assignedWorker);

      // Update task
      await supabase
        .from('ai_work_tasks')
        .update({
          status: success ? 'completed' : 'failed',
          output,
          error_message: success ? null : output.error,
          completed_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      // Update worker stats
      await supabase
        .from('ai_workers')
        .update({
          status: 'active',
          last_task_at: new Date().toISOString(),
          tasks_completed: assignedWorker.tasks_completed + (success ? 1 : 0),
          tasks_failed: (assignedWorker as any).tasks_failed + (success ? 0 : 1),
          experience_points: assignedWorker.experience_points + (success ? 10 : 0),
        })
        .eq('id', assignedWorker.id);

      results.push({
        task_id: task.id,
        worker: assignedWorker.worker_name,
        status: success ? 'completed' : 'failed',
        output,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tasks_processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI Worker Engine Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
