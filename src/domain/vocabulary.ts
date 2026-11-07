// Noms propres que l'utilisateur dit à son agent et que la reconnaissance vocale entend mal sans aide (« VS Code » devient « versus code »).
// Liste courte et intensité basse : un vocabulaire trop large fait apparaître ces mots à la place de mots ordinaires (mesuré).
export const VOCABULARY: (string | { value: string; pronunciations: string[]; intensity: number })[] = [
  { value: "VS Code", pronunciations: ["V S Code"], intensity: 0.5 },
  "Chrome", "Firefox", "bloc-notes", "Spotify", "Discord", "Slack", "Outlook", "Gmail", "YouTube",
  "PowerShell", "GitHub", "Notion", "Figma", "WhatsApp", "LinkedIn", "Excel", "PowerPoint",
];
