// ═══════════════════════════════════════════════════════════════════════════════
// UT SCRIPT ENGINE — Category-Based Scripts, Objections, SMS Templates
// ═══════════════════════════════════════════════════════════════════════════════

export interface UTScript {
  category: string;
  label: string;
  opening: string;
  value_prop: string;
  close: string;
  voicemail: string;
  smsFollowUp: string;
}

export interface UTObjection {
  trigger: string;
  response: string;
}

export interface UTSmsTemplate {
  key: string;
  label: string;
  body: string;
}

export const UT_DISPOSITIONS = [
  { value: 'no_answer', label: 'No Answer', statusMap: 'contacted', requireFollowUp: false },
  { value: 'voicemail_left', label: 'Voicemail Left', statusMap: 'contacted', requireFollowUp: true },
  { value: 'wrong_number', label: 'Wrong Number', statusMap: 'dead', requireFollowUp: false },
  { value: 'gatekeeper', label: 'Gatekeeper', statusMap: 'contacted', requireFollowUp: true },
  { value: 'interested', label: 'Interested', statusMap: 'interested', requireFollowUp: true },
  { value: 'send_info', label: 'Send Info', statusMap: 'contacted', requireFollowUp: true },
  { value: 'callback_requested', label: 'Callback Requested', statusMap: 'callback', requireFollowUp: true },
  { value: 'not_interested', label: 'Not Interested', statusMap: 'dead', requireFollowUp: false },
  { value: 'already_has_provider_flow', label: 'Already Has Provider', statusMap: 'contacted', requireFollowUp: false },
  { value: 'owner_unavailable', label: 'Owner Unavailable', statusMap: 'contacted', requireFollowUp: true },
  { value: 'onboarded', label: '🎉 Onboarded', statusMap: 'onboarded', requireFollowUp: false },
  { value: 'follow_up_required', label: 'Follow-Up Required', statusMap: 'contacted', requireFollowUp: true },
  { value: 'bad_fit', label: 'Bad Fit', statusMap: 'dead', requireFollowUp: false },
] as const;

export type UTDispositionValue = typeof UT_DISPOSITIONS[number]['value'];

export const UT_FOLLOW_UP_PRESETS = [
  { key: 'later_today', label: 'Later Today', hoursFromNow: 3 },
  { key: 'tomorrow_morning', label: 'Tomorrow Morning', hoursFromNow: 18 },
  { key: 'tomorrow_afternoon', label: 'Tomorrow Afternoon', hoursFromNow: 24 },
  { key: 'in_2_days', label: 'In 2 Days', hoursFromNow: 48 },
  { key: 'next_week', label: 'Next Week', hoursFromNow: 168 },
  { key: 'custom', label: 'Custom Date/Time', hoursFromNow: 0 },
] as const;

export const UT_OBJECTIONS: UTObjection[] = [
  {
    trigger: 'We already have enough bookings',
    response: 'That\'s great — you clearly do quality work. We help vendors like you fill those slow months and get discovered by new audiences you wouldn\'t reach otherwise. It\'s additive, not replacement.',
  },
  {
    trigger: 'We already use Instagram / our own site',
    response: 'Perfect — social presence shows you\'re serious. We don\'t replace that. We bring you customers who are actively searching for your exact service right now, ready to book today.',
  },
  {
    trigger: 'We\'re not interested',
    response: 'Totally understand. If I could show you how other [category] vendors in [city] are getting 3-5 extra bookings a month with zero upfront cost, would that change things?',
  },
  {
    trigger: 'Send me information',
    response: 'Absolutely — I\'ll text you a quick overview right now. What\'s the best number to send it to? And just so I send the right info — do you mainly do [category-specific] or a mix?',
  },
  {
    trigger: 'Call back later',
    response: 'Of course. When\'s the best time to reach you? Morning or afternoon? I\'ll put it in my calendar so I don\'t miss you.',
  },
  {
    trigger: 'How much does it cost?',
    response: 'Zero upfront. We bring you customers and you fulfill. You only pay a small referral fee when you actually get booked. No monthly fees, no contracts.',
  },
  {
    trigger: 'How do you get customers?',
    response: 'We\'re building the go-to event planning marketplace. Customers come to us looking for exactly what you offer. We match them to top-rated vendors in their area — that\'s where you come in.',
  },
  {
    trigger: 'Do I have to pay upfront?',
    response: 'Nope. Zero upfront, zero monthly. You only pay when we successfully bring you a paying customer. It\'s pure performance — if we don\'t deliver, it costs you nothing.',
  },
  {
    trigger: 'Who are you guys?',
    response: 'We\'re Unforgettable Times — we\'re building the largest event vendor marketplace in the country. Right now we\'re onboarding the best vendors in [city] before we fully launch. That\'s why I\'m calling you specifically.',
  },
];

export const UT_SCRIPTS: Record<string, UTScript> = {
  event_hall: {
    category: 'event_hall',
    label: 'Event Hall / Venue',
    opening: 'Hey, is this the owner or manager of [Business Name]? My name is [VA Name] with Unforgettable Times.',
    value_prop: 'We\'re building a platform that brings event bookings directly to venues like yours — birthdays, quinceañeras, corporate events, weddings. We already have customers looking for spaces in [City], and I wanted to see if you\'d be open to getting more bookings sent your way.',
    close: 'Can I get you set up? It takes about 2 minutes and there\'s no cost to join. We only earn when you get booked.',
    voicemail: 'Hi, this is [VA Name] with Unforgettable Times. I\'m reaching out because we have event customers looking for venues in [City] and your space came up as a top option. Give me a call back at [Number] — I\'d love to send some bookings your way. Again, [VA Name], Unforgettable Times.',
    smsFollowUp: 'Hey! This is [VA Name] from Unforgettable Times 🎉 I just called about sending event bookings to your venue. No cost to join — customers come to you. Want me to get you set up?',
  },
  decorator: {
    category: 'decorator',
    label: 'Decorator',
    opening: 'Hey, is this the owner of [Business Name]? I\'m [VA Name] calling from Unforgettable Times.',
    value_prop: 'We connect event decorators directly with customers planning birthdays, baby showers, weddings, and more. We have people in [City] actively looking for decoration services and I thought you\'d be a perfect fit.',
    close: 'Would you like me to add you to our vendor list? No upfront cost — you just get more customers.',
    voicemail: 'Hi, this is [VA Name] with Unforgettable Times. We have customers looking for decorators in [City] and your work caught our attention. Call me back at [Number] so I can start sending you bookings.',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times here 🎨 Just called about getting you more decoration clients. Zero cost to join — interested?',
  },
  caterer: {
    category: 'caterer',
    label: 'Caterer',
    opening: 'Hi, is this the owner of [Business Name]? This is [VA Name] from Unforgettable Times.',
    value_prop: 'We\'re a platform that connects caterers with people hosting events in their area. We have customers in [City] looking for catering right now, and your business came up as exactly what they need.',
    close: 'Can I set you up as a partner? It\'s free to join — we just send you paying customers.',
    voicemail: 'Hey, [VA Name] here from Unforgettable Times. We have event hosts looking for caterers in [City]. I\'d love to send some your way. Call me at [Number].',
    smsFollowUp: 'Hi! [VA Name] from Unforgettable Times 🍽️ Called about connecting you with catering customers in your area. Free to join — can I set you up?',
  },
  bartender: {
    category: 'bartender',
    label: 'Bartender / Mobile Bar',
    opening: 'Hey, is this [Contact Name]? I\'m [VA Name] from Unforgettable Times.',
    value_prop: 'We connect mobile bartenders and bar services with people throwing events — weddings, corporate, house parties. We\'ve got demand in [City] and need top bartending services.',
    close: 'Want me to add you? Zero upfront — you just show up and pour.',
    voicemail: 'Hi, [VA Name] with Unforgettable Times. We need bartenders for events in [City]. Call me at [Number] if you want more gigs.',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🍸 Looking for bartenders in [City]. No fees — just bookings. Interested?',
  },
  rental_company: {
    category: 'rental_company',
    label: 'Rental Company',
    opening: 'Hi, am I speaking with the owner of [Business Name]? This is [VA Name] from Unforgettable Times.',
    value_prop: 'We\'re an event marketplace and we need rental companies for tables, chairs, linens, tents, bounce houses — everything event-related. Customers in [City] are already looking.',
    close: 'Can I get you listed? It\'s free and you just get more rental orders.',
    voicemail: 'Hi, [VA Name] from Unforgettable Times. We need rental vendors in [City] for our event customers. Call me at [Number] — free to join.',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🎪 Need rental vendors in [City]. No cost to list — customers come to you. Want in?',
  },
  entertainer: {
    category: 'entertainer',
    label: 'Entertainer / DJ / Musician',
    opening: 'Hey, is this [Contact Name]? I\'m [VA Name] calling from Unforgettable Times.',
    value_prop: 'We book entertainers, DJs, and musicians for events — parties, weddings, corporate. We have gigs in [City] and need quality talent.',
    close: 'Want me to add you to our talent roster? It\'s free — more gigs, no hassle.',
    voicemail: 'Hey, [VA Name] from Unforgettable Times. We have event gigs in [City] looking for entertainment. Call me at [Number].',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🎵 Need entertainers in [City] for upcoming events. Free to join — interested?',
  },
  security: {
    category: 'security',
    label: 'Security Services',
    opening: 'Hi, is this the owner of [Business Name]? This is [VA Name] with Unforgettable Times.',
    value_prop: 'We connect event security providers with venues and event planners. Large events in [City] need professional security and we\'re looking for top providers.',
    close: 'Can I add you as a partner? Free to join — we send you the gigs.',
    voicemail: 'Hi, [VA Name] from Unforgettable Times. Events in [City] need security services. Call me at [Number] to get booked.',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🛡️ Need security for events in [City]. Free to join. Interested?',
  },
  cleaner: {
    category: 'cleaner',
    label: 'Cleaning / Post-Event',
    opening: 'Hey, is this [Contact Name] with [Business Name]? I\'m [VA Name] from Unforgettable Times.',
    value_prop: 'We connect cleaning crews with event venues and hosts. After every party, someone needs cleanup — and our customers in [City] are looking for reliable teams.',
    close: 'Want in? No cost — we bring you steady post-event cleanup work.',
    voicemail: 'Hi, [VA Name] from Unforgettable Times. We need event cleanup crews in [City]. Call me at [Number] for details.',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🧹 Need cleanup crews for events in [City]. Free to join — want more gigs?',
  },
  server: {
    category: 'server',
    label: 'Server / Wait Staff',
    opening: 'Hey, is this [Contact Name]? I\'m [VA Name] from Unforgettable Times.',
    value_prop: 'We provide wait staff and servers for events — weddings, galas, corporate dinners. We need reliable people in [City].',
    close: 'Can I add you to our staff pool? Free — we just book you for events.',
    voicemail: 'Hi, [VA Name] from Unforgettable Times. We need event servers in [City]. Call me at [Number] for opportunities.',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🍽️ Need servers for events in [City]. Flexible gigs, free to join. Interested?',
  },
  other: {
    category: 'other',
    label: 'General / Other',
    opening: 'Hey, is this the owner of [Business Name]? I\'m [VA Name] calling from Unforgettable Times.',
    value_prop: 'We\'re building the largest event vendor marketplace and we\'re looking for top service providers in [City]. We bring you customers who are actively planning events.',
    close: 'Want me to get you set up? It\'s free — we send customers directly to you.',
    voicemail: 'Hi, [VA Name] from Unforgettable Times. We\'re connecting event vendors in [City] with paying customers. Call me at [Number].',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🎉 Looking for event vendors in [City]. Free to join — interested?',
  },
  // Map legacy categories
  dj: {
    category: 'dj',
    label: 'DJ / Musician',
    opening: 'Hey, is this [Contact Name]? I\'m [VA Name] calling from Unforgettable Times.',
    value_prop: 'We book DJs and musicians for events — parties, weddings, corporate. We have gigs in [City] and need quality talent.',
    close: 'Want me to add you to our talent roster? It\'s free — more gigs, no hassle.',
    voicemail: 'Hey, [VA Name] from Unforgettable Times. We have event gigs in [City] for DJs. Call me at [Number].',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🎧 Need DJs in [City]. Free to join — interested?',
  },
  photographer: {
    category: 'photographer',
    label: 'Photographer / Videographer',
    opening: 'Hey, is this [Contact Name] with [Business Name]? I\'m [VA Name] from Unforgettable Times.',
    value_prop: 'We connect event photographers with customers planning weddings, parties, and corporate events in [City]. We have people looking right now.',
    close: 'Can I add you to our vendor list? Free to join — more clients, zero upfront.',
    voicemail: 'Hi, [VA Name] from Unforgettable Times. Customers in [City] need event photographers. Call me at [Number].',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 📸 Need photographers in [City]. Free to join — interested?',
  },
  florist: {
    category: 'florist',
    label: 'Florist',
    opening: 'Hi, is this the owner of [Business Name]? This is [VA Name] from Unforgettable Times.',
    value_prop: 'We connect florists with event planners and customers hosting weddings, parties, and galas. We have demand in [City].',
    close: 'Want in? Free to list — we bring customers to you.',
    voicemail: 'Hi, [VA Name] from Unforgettable Times. Event customers in [City] need florists. Call me at [Number].',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 💐 Need florists in [City]. Free to join — can I set you up?',
  },
  staff: {
    category: 'staff',
    label: 'Event Staff',
    opening: 'Hey, is this [Contact Name]? I\'m [VA Name] from Unforgettable Times.',
    value_prop: 'We provide staffing for events — setup, teardown, serving, coordination. We need reliable people in [City].',
    close: 'Can I add you? Free — we just book you for gigs.',
    voicemail: 'Hi, [VA Name] from Unforgettable Times. We need event staff in [City]. Call me at [Number].',
    smsFollowUp: 'Hey! [VA Name] from Unforgettable Times 🎉 Event staffing gigs in [City]. Free to join — interested?',
  },
};

export const UT_SMS_TEMPLATES: UTSmsTemplate[] = [
  {
    key: 'intro_text',
    label: 'Intro Text',
    body: 'Hey! This is [VA Name] from Unforgettable Times 🎉 We\'re a platform that brings event bookings directly to vendors like you. No upfront cost — customers come to you. Want me to get you set up?',
  },
  {
    key: 'callback_text',
    label: 'Callback Reminder',
    body: 'Hey [Contact Name]! Just following up from our call earlier. This is [VA Name] from Unforgettable Times. Still interested in getting more event bookings? Let me know a good time to chat!',
  },
  {
    key: 'interested_followup',
    label: 'Interested Follow-Up',
    body: 'Hey [Contact Name]! Great talking to you. Here\'s the quick link to get your profile set up on Unforgettable Times: [LINK]. Takes 2 min — then we start sending you customers 🎉',
  },
  {
    key: 'onboarding_link_text',
    label: 'Onboarding Link',
    body: 'Welcome to Unforgettable Times! 🎉 Here\'s your partner setup link: [LINK]. Fill it out and we\'ll start matching you with event customers in your area ASAP.',
  },
  {
    key: 'missed_you_text',
    label: 'Missed Call',
    body: 'Hey! Tried to reach you — this is [VA Name] from Unforgettable Times. We help event vendors get more bookings at no upfront cost. When\'s a good time to chat?',
  },
  {
    key: 'owner_unavailable_text',
    label: 'Owner Unavailable',
    body: 'Hey [Contact Name]! Spoke with your team earlier. I\'m [VA Name] from Unforgettable Times — we connect vendors with event customers. Would love to chat with the owner when they\'re free. What\'s a good time?',
  },
  {
    key: 'send_info_text',
    label: 'Send Info',
    body: 'Hey [Contact Name]! As promised, here\'s info about Unforgettable Times: We\'re a marketplace connecting top event vendors with paying customers. Zero upfront cost — you only pay when you get booked. Ready to join? Reply YES!',
  },
];

export const VA_DAILY_QUOTAS = {
  calls: 100,
  connects: 12,
  interested: 4,
  onboarded: 1,
  callbacksCompleted: 5,
};
