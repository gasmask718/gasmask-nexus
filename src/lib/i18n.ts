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
