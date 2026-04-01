import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { VALeaderboard } from '@/components/va/VALeaderboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminLeaderboard() {
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-slate-400">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-400" />
            <h1 className="text-2xl font-bold text-white">VA Leaderboard</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <Input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white w-40"
            />
          </div>
        </div>

        <VALeaderboard dateFilter={dateFilter} />
      </div>
    </div>
  );
}
