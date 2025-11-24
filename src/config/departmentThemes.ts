export interface DepartmentTheme {
  key: string;
  name: string;
  color: string;
  accent: string;
  lightBg: string;
  colorRgb: string;
}

export const departmentThemes: Record<string, DepartmentTheme> = {
  main: {
    key: 'main',
    name: 'GMA OS',
    color: '#111827',
    accent: '#1F2937',
    lightBg: '#F3F4F6',
    colorRgb: '17, 24, 39'
  },
  realEstate: {
    key: 'realestate',
    name: 'Real Estate Department',
    color: '#4F46E5',
    accent: '#6366F1',
    lightBg: '#EEF2FF',
    colorRgb: '79, 70, 229'
  },
  pod: {
    key: 'pod',
    name: 'POD Department',
    color: '#F97316',
    accent: '#FB923C',
    lightBg: '#FFF7ED',
    colorRgb: '249, 115, 22'
  },
  callCenter: {
    key: 'callcenter',
    name: 'Call Center Cloud',
    color: '#00AFAF',
    accent: '#14B8A6',
    lightBg: '#E0F7F7',
    colorRgb: '0, 175, 175'
  },
  crm: {
    key: 'crm',
    name: 'CRM Department',
    color: '#10B981',       // Emerald green
    accent: '#34D399',
    lightBg: '#D1FAE5',     // Light emerald
    colorRgb: '16, 185, 129'
  }
};
