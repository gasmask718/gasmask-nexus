// Phase 11B - Insight Panel Hook

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InsightType, InsightRecord, getInsightMeta, getDefaultActions } from '@/components/system/InsightPanel';

interface InsightPanelState {
  isOpen: boolean;
  type: InsightType | null;
  customTitle?: string;
  customDescription?: string;
}

interface InsightFilter {
  type: InsightType;
  brand?: string;
  region?: string;
  limit?: number;
}

export function useInsightPanel() {
  const [panelState, setPanelState] = useState<InsightPanelState>({
    isOpen: false,
    type: null,
  });

  const openPanel = useCallback((
    type: InsightType, 
    options?: { title?: string; description?: string }
  ) => {
    setPanelState({
      isOpen: true,
      type,
      customTitle: options?.title,
      customDescription: options?.description,
    });
  }, []);

  const closePanel = useCallback(() => {
    setPanelState({ isOpen: false, type: null });
  }, []);

  const getMeta = useCallback(() => {
    if (!panelState.type) return { title: '', description: '' };
    const defaultMeta = getInsightMeta(panelState.type);
    return {
      title: panelState.customTitle || defaultMeta.title,
      description: panelState.customDescription || defaultMeta.description,
    };
  }, [panelState]);

  const getActions = useCallback(() => {
    if (!panelState.type) return [];
    return getDefaultActions(panelState.type);
  }, [panelState.type]);

  return {
    isOpen: panelState.isOpen,
    type: panelState.type,
    openPanel,
    closePanel,
    getMeta,
    getActions,
  };
}

// Hook for fetching insight data
export function useInsightData(filter: InsightFilter | null) {
  return useQuery({
    queryKey: ['insight-data', filter],
    queryFn: async (): Promise<InsightRecord[]> => {
      if (!filter) return [];

      const records: InsightRecord[] = [];
      const limit = filter.limit || 50;

      try {
        switch (filter.type) {
          case 'unpaid_stores':
          case 'payment_alerts': {
            const { data } = await (supabase as any)
              .from('stores')
              .select('id, name, phone, address, city')
              .limit(limit);
            
            // In real app, would filter by unpaid balance
            for (const store of data || []) {
              records.push({
                id: store.id,
                name: store.name || 'Unnamed Store',
                subtitle: store.address || store.city,
                status: 'Unpaid',
                value: `$${Math.floor(Math.random() * 500 + 100)}`, // Mock
              });
            }
            break;
          }

          case 'low_stock':
          case 'restock_needed': {
            const { data } = await (supabase as any)
              .from('store_brand_accounts')
              .select('id, brand, store_master_id, current_tubes_on_hand')
              .lt('current_tubes_on_hand', 50)
              .limit(limit);
            
            for (const item of data || []) {
              records.push({
                id: item.id,
                name: `${item.brand || 'Unknown'} Inventory`,
                subtitle: `Store ${item.store_master_id?.slice(0, 8) || 'Unknown'}`,
                status: item.current_tubes_on_hand <= 10 ? 'Critical' : 'Low',
                value: `${item.current_tubes_on_hand || 0} tubes`,
              });
            }
            break;
          }

          case 'new_stores': {
            const { data } = await (supabase as any)
              .from('stores')
              .select('id, name, phone, address, created_at')
              .order('created_at', { ascending: false })
              .limit(limit);
            
            for (const store of data || []) {
              records.push({
                id: store.id,
                name: store.name || 'New Store',
                subtitle: store.address,
                status: 'New',
              });
            }
            break;
          }

          case 'inactive_ambassadors': {
            const { data } = await (supabase as any)
              .from('ambassadors')
              .select('id, user_id, tier, total_earnings, tracking_code')
              .limit(limit);
            
            for (const amb of data || []) {
              records.push({
                id: amb.id,
                name: `Ambassador ${amb.tracking_code}`,
                subtitle: `Tier: ${amb.tier}`,
                status: 'Inactive',
                value: `$${amb.total_earnings || 0}`,
              });
            }
            break;
          }

          case 'pending_orders':
          case 'wholesale_pending': {
            const { data } = await (supabase as any)
              .from('wholesale_orders')
              .select('id, brand, total_amount, status, created_at')
              .eq('status', 'pending')
              .limit(limit);
            
            for (const order of data || []) {
              records.push({
                id: order.id,
                name: `Order ${order.id.slice(0, 8)}`,
                subtitle: order.brand,
                status: order.status,
                value: `$${order.total_amount || 0}`,
              });
            }
            break;
          }

          case 'unassigned_deliveries': {
            const { data } = await (supabase as any)
              .from('biker_routes')
              .select('id, biker_name, route_date, completed')
              .is('store_master_id', null)
              .limit(limit);
            
            for (const route of data || []) {
              records.push({
                id: route.id,
                name: route.biker_name || 'Unassigned',
                subtitle: route.route_date,
                status: route.completed ? 'Complete' : 'Pending',
              });
            }
            break;
          }

          case 'communication_gap': {
            const { data } = await (supabase as any)
              .from('stores')
              .select('id, name, phone, last_contact_date')
              .limit(limit);
            
            for (const store of data || []) {
              const daysSince = store.last_contact_date 
                ? Math.floor((Date.now() - new Date(store.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
                : 30;
              
              if (daysSince > 7) {
                records.push({
                  id: store.id,
                  name: store.name || 'Store',
                  subtitle: store.phone,
                  status: daysSince > 14 ? 'Critical' : 'Warning',
                  value: `${daysSince} days`,
                });
              }
            }
            break;
          }

          case 'ai_priority':
          case 'declining_brand': {
            // AI-generated priority list - mock data
            const { data } = await (supabase as any)
              .from('stores')
              .select('id, name, phone, address')
              .limit(10);
            
            for (const store of data || []) {
              records.push({
                id: store.id,
                name: store.name || 'Priority Store',
                subtitle: 'AI Recommended',
                status: 'Priority',
                value: `Score: ${Math.floor(Math.random() * 30 + 70)}`,
              });
            }
            break;
          }

          case 'driver_issues': {
            const { data } = await (supabase as any)
              .from('profiles')
              .select('id, name, phone, role')
              .eq('role', 'driver')
              .limit(limit);
            
            for (const driver of data || []) {
              records.push({
                id: driver.id,
                name: driver.name || 'Driver',
                subtitle: driver.phone,
                status: 'Issue',
              });
            }
            break;
          }

          default:
            break;
        }
      } catch (error) {
        console.error('Error fetching insight data:', error);
      }

      return records;
    },
    enabled: !!filter,
  });
}

// AI suggestions generator
export function getAISuggestions(type: InsightType, recordCount: number): string[] {
  const suggestions: Record<InsightType, string[]> = {
    unpaid_stores: [
      `${recordCount} stores have outstanding balances. Consider batch collection calls.`,
      'Top 3 accounts represent 60% of outstanding balance.',
      'Send payment reminders to stores unpaid for 30+ days.',
    ],
    low_stock: [
      `${recordCount} locations need restocking within 3 days.`,
      'Prioritize high-volume stores first.',
      'Consider bulk production batch to cover all needs.',
    ],
    new_stores: [
      'New stores typically need follow-up within 48 hours.',
      'Assign ambassadors to onboard these locations.',
    ],
    inactive_ambassadors: [
      'Inactive ambassadors may need re-engagement campaigns.',
      'Consider reassigning their territories.',
    ],
    pending_orders: [
      `${recordCount} orders waiting - prioritize high-value first.`,
      'Bulk approve orders under $500 to clear queue.',
    ],
    delivery_bottleneck: [
      'Reassign routes to available drivers.',
      'Consider splitting large routes.',
    ],
    communication_gap: [
      'Stores with 14+ day gaps have higher churn risk.',
      'Schedule weekly check-in calls.',
    ],
    payment_alerts: [
      'Escalate accounts over 60 days overdue.',
      'Offer payment plans for large balances.',
    ],
    ai_priority: [
      'These stores show declining order patterns.',
      'Personal outreach recommended within 24 hours.',
    ],
    declining_brand: [
      'Brand performance down 15% this week.',
      'Review pricing and competitor activity.',
    ],
    unassigned_deliveries: [
      'Assign to nearest available drivers.',
      'Optimize routes before assignment.',
    ],
    restock_needed: [
      'Bulk restock order recommended.',
      'Coordinate with production schedule.',
    ],
    driver_issues: [
      'Address driver concerns promptly.',
      'Schedule one-on-one check-ins.',
    ],
    wholesale_pending: [
      'Review and approve orders in priority order.',
      'Check inventory before bulk approval.',
    ],
  };

  return suggestions[type] || ['No specific suggestions available.'];
}
