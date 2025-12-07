export interface BrandTheme {
  name: string;
  primary: string;
  primaryRgb: string;
  accent: string;
  accentRgb: string;
  gradient: string;
}

export const brandThemes: Record<string, BrandTheme> = {
  gasmask: {
    name: "GasMask",
    primary: "#FF0000",
    primaryRgb: "255, 0, 0",
    accent: "#000000",
    accentRgb: "0, 0, 0",
    gradient: "linear-gradient(135deg, #FF0000, #000000)"
  },
  hotmama: {
    name: "HotMama",
    primary: "#FF4F9D",
    primaryRgb: "255, 79, 157",
    accent: "#FFC2D6",
    accentRgb: "255, 194, 214",
    gradient: "linear-gradient(135deg, #FF4F9D, #FFC2D6)"
  },
  grabba: {
    name: "Grabba R Us",
    primary: "#FFD700",
    primaryRgb: "255, 215, 0",
    accent: "#0066CC",
    accentRgb: "0, 102, 204",
    gradient: "linear-gradient(135deg, #FFD700, #FF0000, #0066CC)"
  },
  scalati: {
    name: "Hot Scalati",
    primary: "#FF1A1A",
    primaryRgb: "255, 26, 26",
    accent: "#000000",
    accentRgb: "0, 0, 0",
    gradient: "linear-gradient(135deg, #000000, #FF1A1A)"
  },
  toptier: {
    name: "TopTier",
    primary: "#C0C0C0",
    primaryRgb: "192, 192, 192",
    accent: "#000000",
    accentRgb: "0, 0, 0",
    gradient: "linear-gradient(135deg, #000000, #C0C0C0)"
  },
  playboxxx: {
    name: "Playboxxx",
    primary: "#FF1493",
    primaryRgb: "255, 20, 147",
    accent: "#00BFFF",
    accentRgb: "0, 191, 255",
    gradient: "linear-gradient(135deg, #FF1493, #00BFFF)"
  },
  iclean: {
    name: "iClean WeClean",
    primary: "#0099CC",
    primaryRgb: "0, 153, 204",
    accent: "#00CC66",
    accentRgb: "0, 204, 102",
    gradient: "linear-gradient(135deg, #0099CC, #00CC66)"
  },
  tte: {
    name: "Unforgettable Times",
    primary: "#FF6B6B",
    primaryRgb: "255, 107, 107",
    accent: "#4ECDC4",
    accentRgb: "78, 205, 196",
    gradient: "linear-gradient(135deg, #FF6B6B, #FFE66D, #4ECDC4, #95E1D3)"
  },
  funding: {
    name: "Funding & Grants",
    primary: "#0047AB",
    primaryRgb: "0, 71, 171",
    accent: "#FFD700",
    accentRgb: "255, 215, 0",
    gradient: "linear-gradient(135deg, #0047AB, #FFD700)"
  },
  investments: {
    name: "Dynasty Investments",
    primary: "#FFD700",
    primaryRgb: "255, 215, 0",
    accent: "#000000",
    accentRgb: "0, 0, 0",
    gradient: "linear-gradient(135deg, #FFD700, #000000)"
  },
  betting: {
    name: "Sports Betting",
    primary: "#00CC44",
    primaryRgb: "0, 204, 68",
    accent: "#000000",
    accentRgb: "0, 0, 0",
    gradient: "linear-gradient(135deg, #00CC44, #000000)"
  },
  specialneeds: {
    name: "Special Needs App",
    primary: "#9B59B6",
    primaryRgb: "155, 89, 182",
    accent: "#1ABC9C",
    accentRgb: "26, 188, 156",
    gradient: "linear-gradient(135deg, #9B59B6, #1ABC9C)"
  }
};
