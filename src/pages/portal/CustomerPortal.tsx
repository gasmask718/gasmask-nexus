import { useNavigate } from 'react-router-dom';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useTranslation } from '@/hooks/useTranslation';
import PortalDashboard from '@/layouts/PortalDashboard';
import { HudCard } from '@/components/portal/HudCard';
import { HudButton } from '@/components/portal/HudButton';
import { HudMetric } from '@/components/portal/HudMetric';
import { HudStatusBadge } from '@/components/portal/HudStatusBadge';
import { ShoppingBag, Package, MapPin, Gift, MessageCircle, Clock, ChevronRight, Star } from 'lucide-react';

export default function CustomerPortal() {
  const navigate = useNavigate();
  const { data } = useCurrentUserProfile();
  const { t } = useTranslation();
  const profile = data?.profile;

  // Mock data for demonstration
  const recentOrders = [
    { id: 'ORD-001', date: '2024-01-15', items: 3, total: 45.99, status: 'delivered' as const },
    { id: 'ORD-002', date: '2024-01-20', items: 2, total: 29.99, status: 'in_transit' as const },
  ];

  const activeDelivery = recentOrders.find(o => o.status === 'in_transit');

  return (
    <PortalDashboard
      title={t('my_account')}
      subtitle={`Welcome back, ${profile?.full_name || 'Customer'}!`}
    >
      <div className="space-y-6">
        {/* Active Delivery Banner */}
        {activeDelivery && (
          <HudCard variant="cyan" className="border-hud-cyan/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-hud-cyan/20">
                  <Package className="h-6 w-6 text-hud-cyan" />
                </div>
                <div>
                  <p className="text-hud-cyan font-semibold">{t('order_on_the_way')}</p>
                  <p className="text-sm text-muted-foreground">
                    {activeDelivery.id} • Estimated arrival: Today 4-6 PM
                  </p>
                </div>
              </div>
              <HudButton variant="cyan" size="sm" onClick={() => navigate('/portal/customer/track')}>
                {t('track_order')}
              </HudButton>
            </div>
          </HudCard>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <HudCard variant="cyan">
            <HudMetric
              label={t('total_orders')}
              value="12"
              icon={<ShoppingBag className="h-4 w-4" />}
              variant="cyan"
              size="sm"
            />
          </HudCard>
          <HudCard variant="amber">
            <HudMetric
              label={t('rewards_points')}
              value="450"
              icon={<Star className="h-4 w-4" />}
              variant="amber"
              size="sm"
            />
          </HudCard>
          <HudCard variant="green">
            <HudMetric
              label={t('saved_addresses')}
              value="2"
              icon={<MapPin className="h-4 w-4" />}
              variant="green"
              size="sm"
            />
          </HudCard>
          <HudCard variant="purple">
            <HudMetric
              label={t('available_deals')}
              value="3"
              icon={<Gift className="h-4 w-4" />}
              variant="purple"
              size="sm"
            />
          </HudCard>
        </div>

        {/* Main Actions Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Shop Now */}
          <div className="cursor-pointer" onClick={() => navigate('/shop')}>
            <HudCard variant="cyan" className="hover:border-hud-cyan/70 transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-hud-cyan/20">
                  <ShoppingBag className="h-8 w-8 text-hud-cyan" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{t('shop_now')}</h3>
                  <p className="text-sm text-muted-foreground">{t('browse_products')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </HudCard>
          </div>

          {/* My Orders */}
          <div className="cursor-pointer">
            <HudCard variant="green" className="hover:border-hud-green/70 transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-hud-green/20">
                  <Package className="h-8 w-8 text-hud-green" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{t('my_orders')}</h3>
                  <p className="text-sm text-muted-foreground">{t('view_order_history')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </HudCard>
          </div>

          {/* Rewards */}
          <div className="cursor-pointer">
            <HudCard variant="amber" className="hover:border-hud-amber/70 transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-hud-amber/20">
                  <Gift className="h-8 w-8 text-hud-amber" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{t('rewards')}</h3>
                  <p className="text-sm text-muted-foreground">{t('redeem_points')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </HudCard>
          </div>

          {/* Addresses */}
          <div className="cursor-pointer">
            <HudCard variant="purple" className="hover:border-hud-purple/70 transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-hud-purple/20">
                  <MapPin className="h-8 w-8 text-hud-purple" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{t('addresses')}</h3>
                  <p className="text-sm text-muted-foreground">{t('manage_addresses')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </HudCard>
          </div>

          {/* Support */}
          <div className="cursor-pointer">
            <HudCard variant="cyan" className="hover:border-hud-cyan/70 transition-colors h-full">
              <div className="flex items-center gap-4">
                <div className="p-4 rounded-xl bg-hud-cyan/20">
                  <MessageCircle className="h-8 w-8 text-hud-cyan" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{t('support')}</h3>
                  <p className="text-sm text-muted-foreground">{t('get_help')}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </HudCard>
          </div>
        </div>

        {/* Recent Orders */}
        <HudCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">{t('recent_orders')}</h3>
            <HudButton variant="default" size="sm">{t('view_all')}</HudButton>
          </div>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{order.id}</p>
                    <p className="text-sm text-muted-foreground">{order.date} • {order.items} items</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <HudStatusBadge
                    status={order.status === 'delivered' ? 'completed' : 'pending'}
                    label={order.status === 'delivered' ? 'Delivered' : 'In Transit'}
                  />
                  <span className="font-bold">${order.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </HudCard>
      </div>
    </PortalDashboard>
  );
}
