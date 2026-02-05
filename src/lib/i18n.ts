// Translation layer for multi-language support
export type SupportedLanguage = 'en' | 'es' | 'ar' | 'fr';

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  ar: 'العربية',
  fr: 'Français',
};

// Translation dictionaries
const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Common
    'welcome': 'Welcome',
    'dashboard': 'Dashboard',
    'settings': 'Settings',
    'logout': 'Logout',
    'save': 'Save',
    'cancel': 'Cancel',
    'submit': 'Submit',
    'loading': 'Loading...',
    'error': 'Error',
    'success': 'Success',
    'no_permission': 'You do not have permission for this action.',
    'no_data': 'No data available',
    
    // Navigation
    'nav.home': 'Home',
    'nav.routes': 'Routes',
    'nav.stores': 'Stores',
    'nav.orders': 'Orders',
    'nav.inventory': 'Inventory',
    'nav.earnings': 'Earnings',
    'nav.tasks': 'Tasks',
    'nav.profile': 'Profile',
    
    // Guidance System
    'guidance.purpose': 'Purpose',
    'guidance.what_to_do': 'What to do here',
    'guidance.important': 'Important',
    'guidance.data_from': 'Data from',
    'guidance.affected_by': 'Affected by',
    'guidance.requires_approval': '⚠️ Changes require admin approval',
    'guidance.needs_approval': 'needs approval',
    'guidance.account_update': 'How to Update Your Account',
    'guidance.can_edit': 'You Can Edit',
    'guidance.read_only': 'Read Only (Contact Admin)',
    'guidance.after_submit': 'After you submit changes:',
    'guidance.instant_changes': 'Some changes apply instantly',
    'guidance.approval_wait': 'Others go to admin for review',
    'guidance.notified': "You'll be notified when approved",
    
    // Page Purposes
    'page.dashboard.purpose': 'Your daily command center showing assigned stops, shift status, and pending actions.',
    'page.dashboard.action.view_stores': 'View assigned stores',
    'page.dashboard.action.start_visit': 'Start a store visit',
    'page.dashboard.action.check_changes': 'Check pending change lists',
    'page.stores.purpose': 'Browse and select stores for visits or deliveries.',
    'page.visit.purpose': 'Log your store visit with inventory counts, sticker status, and notes.',
    'page.delivery.purpose': 'Record delivery details and get customer confirmation.',
    'page.changes.purpose': 'Track your submitted changes and their approval status.',
    'page.history.purpose': 'Review your past visits, deliveries, and submissions.',
    'page.messages.purpose': 'Communicate with dispatch and receive important updates.',
    'page.profile.purpose': 'Update your account information and preferences.',
    
    // Card Helpers
    'card.tube_inventory': 'Shows current tube counts per product at this store.',
    'card.tube_inventory.detail': 'Update counts during visits. Changes sync to inventory.',
    'card.stickers': 'Sticker visibility status for each brand.',
    'card.stickers.detail': 'Toggle stickers on/off based on what you observe.',
    'card.orders': 'Recent orders placed by this store.',
    'card.kpi': 'Key performance indicators for this store.',
    'card.shift': 'Your current shift status and duration.',
    'card.stops': 'Stores assigned to you for today.',
    
    // Tube Inventory
    'tube_inventory.title': 'Tube Inventory',
    'tube_inventory.count': 'Tube count',
    'tube_inventory.last_order': 'Last order',
    'tube_inventory.never_ordered': 'Never ordered',
    'tube_inventory.out_of_stock': 'Out of stock',
    'tube_inventory.low_stock': 'Low stock',
    
    // Status Labels
    'status.pending': 'Pending',
    'status.in_progress': 'In Progress',
    'status.completed': 'Completed',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.under_review': 'Under Review',
    
    // Driver Portal
    'driver.title': 'Driver Portal',
    'driver.todays_route': "Today's Route",
    'driver.assigned_stores': 'Assigned Stores',
    'driver.deliveries': 'Deliveries',
    'driver.earnings': 'Earnings',
    'driver.documents': 'Documents',
    
    // Biker Portal
    'biker.title': 'Store Checker Portal',
    'biker.pickups': 'Pickup List',
    'biker.dropoffs': 'Dropoff Confirmation',
    'biker.map': 'Map View',
    'biker.assigned_visits': 'Assigned Store Visits',
    
    // Ambassador Portal
    'ambassador.title': 'Ambassador Portal',
    'ambassador.my_stores': 'My Stores',
    'ambassador.commissions': 'Commissions',
    'ambassador.bonuses': 'Bonuses',
    'ambassador.signup_form': 'Store Sign-Up Form',
    'ambassador.referral_code': 'Referral Code',
    
    // Store Portal
    'store.title': 'Store Portal',
    'store.order_products': 'Order Products',
    'store.track_orders': 'Track Orders',
    'store.delivery_eta': 'Delivery ETA',
    'store.reorder': 'Reorder',
    'store.catalog': 'Product Catalog',
    
    // Wholesaler Portal
    'wholesaler.title': 'Wholesaler Portal',
    'wholesaler.upload_products': 'Upload Products',
    'wholesaler.inventory': 'Inventory',
    'wholesaler.store_orders': 'Orders from Stores',
    'wholesaler.customer_orders': 'Customer Orders',
    'wholesaler.payouts': 'Payouts',
    
    // Production Portal
    'production.title': 'Production Portal',
    'production.daily_counts': 'Daily Counts',
    'production.total_boxes': 'Total Boxes Made',
    'production.defects': 'Defects',
    'production.tools': 'Tools Used',
    'production.inventory_changes': 'Inventory Changes',
    
    // VA Portal
    'va.title': 'VA Staff Portal',
    'va.crm_dashboard': 'CRM Dashboard',
    'va.contact_editor': 'Contact Editor',
    'va.store_editor': 'Store Editor',
    'va.upload_excel': 'Upload Excel',
    'va.assign_tasks': 'Assign Tasks to AI',
    
    // Customer Portal
    'my_account': 'My Account',
    'welcome_back': 'Welcome back',
    'customer': 'Customer',
    'order_on_the_way': 'Order On The Way!',
    'track_order': 'Track Order',
    'total_orders': 'Total Orders',
    'rewards_points': 'Rewards Points',
    'saved_addresses': 'Saved Addresses',
    'available_deals': 'Available Deals',
    'shop_now': 'Shop Now',
    'browse_products': 'Browse our products',
    'my_orders': 'My Orders',
    'view_order_history': 'View order history',
    'rewards': 'Rewards',
    'redeem_points': 'Redeem your points',
    'addresses': 'Addresses',
    'manage_addresses': 'Manage delivery addresses',
    'support': 'Support',
    'get_help': 'Get help with orders',
    'recent_orders': 'Recent Orders',
    'view_all': 'View All',
  },
  es: {
    // Common
    'welcome': 'Bienvenido',
    'dashboard': 'Panel',
    'settings': 'Configuración',
    'logout': 'Cerrar sesión',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'submit': 'Enviar',
    'loading': 'Cargando...',
    'error': 'Error',
    'success': 'Éxito',
    'no_permission': 'No tiene permiso para esta acción.',
    'no_data': 'No hay datos disponibles',
    
    // Navigation
    'nav.home': 'Inicio',
    'nav.routes': 'Rutas',
    'nav.stores': 'Tiendas',
    'nav.orders': 'Pedidos',
    'nav.inventory': 'Inventario',
    'nav.earnings': 'Ganancias',
    'nav.tasks': 'Tareas',
    'nav.profile': 'Perfil',
    
    // Guidance System
    'guidance.purpose': 'Propósito',
    'guidance.what_to_do': 'Qué hacer aquí',
    'guidance.important': 'Importante',
    'guidance.data_from': 'Datos de',
    'guidance.affected_by': 'Afectado por',
    'guidance.requires_approval': '⚠️ Los cambios requieren aprobación del administrador',
    'guidance.needs_approval': 'requiere aprobación',
    'guidance.account_update': 'Cómo Actualizar Tu Cuenta',
    'guidance.can_edit': 'Puedes Editar',
    'guidance.read_only': 'Solo Lectura (Contactar Admin)',
    'guidance.after_submit': 'Después de enviar cambios:',
    'guidance.instant_changes': 'Algunos cambios se aplican al instante',
    'guidance.approval_wait': 'Otros van al administrador para revisión',
    'guidance.notified': 'Se te notificará cuando se aprueben',
    
    // Page Purposes
    'page.dashboard.purpose': 'Tu centro de comando diario mostrando paradas asignadas, estado del turno y acciones pendientes.',
    'page.dashboard.action.view_stores': 'Ver tiendas asignadas',
    'page.dashboard.action.start_visit': 'Iniciar una visita a tienda',
    'page.dashboard.action.check_changes': 'Revisar listas de cambios pendientes',
    'page.stores.purpose': 'Navegar y seleccionar tiendas para visitas o entregas.',
    'page.visit.purpose': 'Registrar tu visita con conteos de inventario, estado de calcomanías y notas.',
    'page.delivery.purpose': 'Registrar detalles de entrega y obtener confirmación del cliente.',
    'page.changes.purpose': 'Seguir tus cambios enviados y su estado de aprobación.',
    'page.history.purpose': 'Revisar tus visitas, entregas y envíos pasados.',
    'page.messages.purpose': 'Comunicarte con despacho y recibir actualizaciones importantes.',
    'page.profile.purpose': 'Actualizar tu información de cuenta y preferencias.',
    
    // Card Helpers
    'card.tube_inventory': 'Muestra los conteos actuales de tubos por producto en esta tienda.',
    'card.tube_inventory.detail': 'Actualiza los conteos durante las visitas. Los cambios se sincronizan con el inventario.',
    'card.stickers': 'Estado de visibilidad de calcomanías para cada marca.',
    'card.stickers.detail': 'Activa/desactiva calcomanías según lo que observes.',
    'card.orders': 'Pedidos recientes realizados por esta tienda.',
    'card.kpi': 'Indicadores clave de rendimiento para esta tienda.',
    'card.shift': 'Tu estado de turno actual y duración.',
    'card.stops': 'Tiendas asignadas para hoy.',
    
    // Tube Inventory
    'tube_inventory.title': 'Inventario de Tubos',
    'tube_inventory.count': 'Conteo de tubos',
    'tube_inventory.last_order': 'Último pedido',
    'tube_inventory.never_ordered': 'Nunca ordenado',
    'tube_inventory.out_of_stock': 'Agotado',
    'tube_inventory.low_stock': 'Stock bajo',
    
    // Status Labels
    'status.pending': 'Pendiente',
    'status.in_progress': 'En Progreso',
    'status.completed': 'Completado',
    'status.approved': 'Aprobado',
    'status.rejected': 'Rechazado',
    'status.under_review': 'En Revisión',
    
    // Driver Portal
    'driver.title': 'Portal del Conductor',
    'driver.todays_route': 'Ruta de Hoy',
    'driver.assigned_stores': 'Tiendas Asignadas',
    'driver.deliveries': 'Entregas',
    'driver.earnings': 'Ganancias',
    'driver.documents': 'Documentos',
    
    // Biker Portal
    'biker.title': 'Portal del Verificador',
    'biker.pickups': 'Lista de Recogidas',
    'biker.dropoffs': 'Confirmación de Entrega',
    'biker.map': 'Vista del Mapa',
    'biker.assigned_visits': 'Visitas Asignadas',
    
    // Ambassador Portal
    'ambassador.title': 'Portal del Embajador',
    'ambassador.my_stores': 'Mis Tiendas',
    'ambassador.commissions': 'Comisiones',
    'ambassador.bonuses': 'Bonificaciones',
    'ambassador.signup_form': 'Formulario de Registro',
    'ambassador.referral_code': 'Código de Referido',
    
    // Store Portal
    'store.title': 'Portal de Tienda',
    'store.order_products': 'Pedir Productos',
    'store.track_orders': 'Seguir Pedidos',
    'store.delivery_eta': 'Tiempo de Entrega',
    'store.reorder': 'Reordenar',
    'store.catalog': 'Catálogo de Productos',
    
    // Wholesaler Portal
    'wholesaler.title': 'Portal de Mayorista',
    'wholesaler.upload_products': 'Subir Productos',
    'wholesaler.inventory': 'Inventario',
    'wholesaler.store_orders': 'Pedidos de Tiendas',
    'wholesaler.customer_orders': 'Pedidos de Clientes',
    'wholesaler.payouts': 'Pagos',
    
    // Production Portal
    'production.title': 'Portal de Producción',
    'production.daily_counts': 'Conteos Diarios',
    'production.total_boxes': 'Cajas Totales',
    'production.defects': 'Defectos',
    'production.tools': 'Herramientas',
    'production.inventory_changes': 'Cambios de Inventario',
    
    // VA Portal
    'va.title': 'Portal del Asistente',
    'va.crm_dashboard': 'Panel de CRM',
    'va.contact_editor': 'Editor de Contactos',
    'va.store_editor': 'Editor de Tiendas',
    'va.upload_excel': 'Subir Excel',
    'va.assign_tasks': 'Asignar Tareas a IA',
  },
  ar: {
    // Common
    'welcome': 'مرحباً',
    'dashboard': 'لوحة التحكم',
    'settings': 'الإعدادات',
    'logout': 'تسجيل الخروج',
    'save': 'حفظ',
    'cancel': 'إلغاء',
    'submit': 'إرسال',
    'loading': 'جاري التحميل...',
    'error': 'خطأ',
    'success': 'نجاح',
    'no_permission': 'ليس لديك إذن لهذا الإجراء.',
    'no_data': 'لا توجد بيانات متاحة',
    
    // Navigation
    'nav.home': 'الرئيسية',
    'nav.routes': 'المسارات',
    'nav.stores': 'المتاجر',
    'nav.orders': 'الطلبات',
    'nav.inventory': 'المخزون',
    'nav.earnings': 'الأرباح',
    'nav.tasks': 'المهام',
    'nav.profile': 'الملف الشخصي',
    
    // Guidance System
    'guidance.purpose': 'الغرض',
    'guidance.what_to_do': 'ماذا تفعل هنا',
    'guidance.important': 'مهم',
    'guidance.data_from': 'البيانات من',
    'guidance.affected_by': 'يتأثر بـ',
    'guidance.requires_approval': '⚠️ التغييرات تتطلب موافقة المسؤول',
    'guidance.needs_approval': 'يتطلب موافقة',
    'guidance.account_update': 'كيفية تحديث حسابك',
    'guidance.can_edit': 'يمكنك التعديل',
    'guidance.read_only': 'للقراءة فقط (اتصل بالمسؤول)',
    'guidance.after_submit': 'بعد إرسال التغييرات:',
    'guidance.instant_changes': 'بعض التغييرات تُطبق فوراً',
    'guidance.approval_wait': 'البعض الآخر يذهب للمسؤول للمراجعة',
    'guidance.notified': 'سيتم إخطارك عند الموافقة',
    
    // Page Purposes
    'page.dashboard.purpose': 'مركز التحكم اليومي يعرض المحطات المخصصة وحالة النوبة والإجراءات المعلقة.',
    'page.dashboard.action.view_stores': 'عرض المتاجر المخصصة',
    'page.dashboard.action.start_visit': 'بدء زيارة متجر',
    'page.dashboard.action.check_changes': 'مراجعة قوائم التغييرات المعلقة',
    'page.stores.purpose': 'تصفح واختيار المتاجر للزيارات أو التوصيلات.',
    'page.visit.purpose': 'تسجيل زيارتك مع عد المخزون وحالة الملصقات والملاحظات.',
    'page.delivery.purpose': 'تسجيل تفاصيل التوصيل والحصول على تأكيد العميل.',
    'page.changes.purpose': 'تتبع التغييرات المرسلة وحالة الموافقة.',
    'page.history.purpose': 'مراجعة زياراتك وتوصيلاتك السابقة.',
    'page.messages.purpose': 'التواصل مع الإرسال وتلقي التحديثات المهمة.',
    'page.profile.purpose': 'تحديث معلومات حسابك وتفضيلاتك.',
    
    // Card Helpers
    'card.tube_inventory': 'يعرض عدد الأنابيب الحالي لكل منتج في هذا المتجر.',
    'card.tube_inventory.detail': 'حدث العد أثناء الزيارات. التغييرات تتزامن مع المخزون.',
    'card.stickers': 'حالة ظهور الملصقات لكل علامة تجارية.',
    'card.stickers.detail': 'شغل/أوقف الملصقات بناءً على ما تلاحظه.',
    'card.orders': 'الطلبات الأخيرة لهذا المتجر.',
    'card.kpi': 'مؤشرات الأداء الرئيسية لهذا المتجر.',
    'card.shift': 'حالة نوبتك الحالية والمدة.',
    'card.stops': 'المتاجر المخصصة لك اليوم.',
    
    // Tube Inventory
    'tube_inventory.title': 'مخزون الأنابيب',
    'tube_inventory.count': 'عدد الأنابيب',
    'tube_inventory.last_order': 'آخر طلب',
    'tube_inventory.never_ordered': 'لم يُطلب أبداً',
    'tube_inventory.out_of_stock': 'نفد من المخزون',
    'tube_inventory.low_stock': 'مخزون منخفض',
    
    // Status Labels
    'status.pending': 'معلق',
    'status.in_progress': 'قيد التنفيذ',
    'status.completed': 'مكتمل',
    'status.approved': 'معتمد',
    'status.rejected': 'مرفوض',
    'status.under_review': 'قيد المراجعة',
    
    // Driver Portal
    'driver.title': 'بوابة السائق',
    'driver.todays_route': 'مسار اليوم',
    'driver.assigned_stores': 'المتاجر المعينة',
    'driver.deliveries': 'التوصيلات',
    'driver.earnings': 'الأرباح',
    'driver.documents': 'المستندات',
    
    // Biker Portal
    'biker.title': 'بوابة المفتش',
    'biker.pickups': 'قائمة الاستلام',
    'biker.dropoffs': 'تأكيد التسليم',
    'biker.map': 'عرض الخريطة',
    'biker.assigned_visits': 'الزيارات المعينة',
    
    // Ambassador Portal
    'ambassador.title': 'بوابة السفير',
    'ambassador.my_stores': 'متاجري',
    'ambassador.commissions': 'العمولات',
    'ambassador.bonuses': 'المكافآت',
    'ambassador.signup_form': 'نموذج التسجيل',
    'ambassador.referral_code': 'رمز الإحالة',
    
    // Store Portal
    'store.title': 'بوابة المتجر',
    'store.order_products': 'طلب المنتجات',
    'store.track_orders': 'تتبع الطلبات',
    'store.delivery_eta': 'وقت التوصيل',
    'store.reorder': 'إعادة الطلب',
    'store.catalog': 'كتالوج المنتجات',
    
    // Wholesaler Portal
    'wholesaler.title': 'بوابة تاجر الجملة',
    'wholesaler.upload_products': 'رفع المنتجات',
    'wholesaler.inventory': 'المخزون',
    'wholesaler.store_orders': 'طلبات المتاجر',
    'wholesaler.customer_orders': 'طلبات العملاء',
    'wholesaler.payouts': 'المدفوعات',
    
    // Production Portal
    'production.title': 'بوابة الإنتاج',
    'production.daily_counts': 'العد اليومي',
    'production.total_boxes': 'إجمالي الصناديق',
    'production.defects': 'العيوب',
    'production.tools': 'الأدوات',
    'production.inventory_changes': 'تغييرات المخزون',
    
    // VA Portal
    'va.title': 'بوابة المساعد',
    'va.crm_dashboard': 'لوحة CRM',
    'va.contact_editor': 'محرر جهات الاتصال',
    'va.store_editor': 'محرر المتاجر',
    'va.upload_excel': 'رفع Excel',
    'va.assign_tasks': 'تعيين مهام للذكاء الاصطناعي',
  },
  fr: {
    // Common
    'welcome': 'Bienvenue',
    'dashboard': 'Tableau de bord',
    'settings': 'Paramètres',
    'logout': 'Déconnexion',
    'save': 'Enregistrer',
    'cancel': 'Annuler',
    'submit': 'Soumettre',
    'loading': 'Chargement...',
    'error': 'Erreur',
    'success': 'Succès',
    'no_permission': "Vous n'avez pas la permission pour cette action.",
    'no_data': 'Aucune donnée disponible',
    
    // Navigation
    'nav.home': 'Accueil',
    'nav.routes': 'Itinéraires',
    'nav.stores': 'Magasins',
    'nav.orders': 'Commandes',
    'nav.inventory': 'Inventaire',
    'nav.earnings': 'Revenus',
    'nav.tasks': 'Tâches',
    'nav.profile': 'Profil',
    
    // Driver Portal
    'driver.title': 'Portail Conducteur',
    'driver.todays_route': "Itinéraire du Jour",
    'driver.assigned_stores': 'Magasins Assignés',
    'driver.deliveries': 'Livraisons',
    'driver.earnings': 'Revenus',
    'driver.documents': 'Documents',
    
    // Biker Portal
    'biker.title': 'Portail Vérificateur',
    'biker.pickups': 'Liste de Collecte',
    'biker.dropoffs': 'Confirmation de Livraison',
    'biker.map': 'Vue Carte',
    'biker.assigned_visits': 'Visites Assignées',
    
    // Ambassador Portal
    'ambassador.title': 'Portail Ambassadeur',
    'ambassador.my_stores': 'Mes Magasins',
    'ambassador.commissions': 'Commissions',
    'ambassador.bonuses': 'Bonus',
    'ambassador.signup_form': "Formulaire d'Inscription",
    'ambassador.referral_code': 'Code de Parrainage',
    
    // Store Portal
    'store.title': 'Portail Magasin',
    'store.order_products': 'Commander des Produits',
    'store.track_orders': 'Suivre les Commandes',
    'store.delivery_eta': 'Délai de Livraison',
    'store.reorder': 'Commander à nouveau',
    'store.catalog': 'Catalogue de Produits',
    
    // Wholesaler Portal
    'wholesaler.title': 'Portail Grossiste',
    'wholesaler.upload_products': 'Télécharger des Produits',
    'wholesaler.inventory': 'Inventaire',
    'wholesaler.store_orders': 'Commandes des Magasins',
    'wholesaler.customer_orders': 'Commandes des Clients',
    'wholesaler.payouts': 'Paiements',
    
    // Production Portal
    'production.title': 'Portail Production',
    'production.daily_counts': 'Comptages Journaliers',
    'production.total_boxes': 'Total des Boîtes',
    'production.defects': 'Défauts',
    'production.tools': 'Outils',
    'production.inventory_changes': "Changements d'Inventaire",
    
    // VA Portal
    'va.title': 'Portail Assistant',
    'va.crm_dashboard': 'Tableau de bord CRM',
    'va.contact_editor': 'Éditeur de Contacts',
    'va.store_editor': 'Éditeur de Magasins',
    'va.upload_excel': 'Télécharger Excel',
    'va.assign_tasks': "Assigner des Tâches à l'IA",
  },
};

// Get browser language or fallback to 'en'
export function detectLanguage(): SupportedLanguage {
  const browserLang = navigator.language.split('-')[0];
  if (browserLang in translations) {
    return browserLang as SupportedLanguage;
  }
  return 'en';
}

// Main translation function
export function t(key: string, lang: SupportedLanguage = 'en'): string {
  return translations[lang]?.[key] || translations['en']?.[key] || key;
}

// Get all available languages
export function getAvailableLanguages(): { code: SupportedLanguage; name: string }[] {
  return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    code: code as SupportedLanguage,
    name,
  }));
}

// Check if language is RTL
export function isRTL(lang: SupportedLanguage): boolean {
  return lang === 'ar';
}
