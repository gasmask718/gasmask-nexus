export interface DepartmentTheme {
  name: string;
  color: string;
  colorRgb: string;
}

export const departmentThemes: Record<string, DepartmentTheme> = {
  core: {
    name: "Core System",
    color: "#FFD700",
    colorRgb: "255, 215, 0"
  },
  gasmask: {
    name: "GasMask Department",
    color: "#FF1A1A",
    colorRgb: "255, 26, 26"
  },
  pod: {
    name: "POD Department",
    color: "#1A3D8F",
    colorRgb: "26, 61, 143"
  },
  realestate: {
    name: "Real Estate Department",
    color: "#7D3C98",
    colorRgb: "125, 60, 152"
  },
  callcenter: {
    name: "Call Center Department",
    color: "#00AFAF",
    colorRgb: "0, 175, 175"
  },
  crm: {
    name: "CRM Department",
    color: "#FFD700",
    colorRgb: "255, 215, 0"
  }
};
