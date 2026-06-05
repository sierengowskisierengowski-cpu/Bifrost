export interface OllamaModel {
  name: string;
  goodFor: string;
  minRamGb: number;
  recommendedUse: string;
}

/* Ordered ascending by RAM requirement — autoSelectModel relies on this order. */
export const OLLAMA_MODELS: OllamaModel[] = [
  {
    name: "qwen2.5:0.5b-instruct",
    goodFor: "Ultra-light triage on constrained hardware",
    minRamGb: 2,
    recommendedUse: "Raspberry Pi / always-on edge nodes",
  },
  {
    name: "qwen2.5:1.5b-instruct",
    goodFor: "Fast event triage with solid accuracy",
    minRamGb: 4,
    recommendedUse: "Default for most home setups",
  },
  {
    name: "qwen2.5:3b-instruct",
    goodFor: "Balanced reasoning and classification",
    minRamGb: 6,
    recommendedUse: "Mini-PCs and modern laptops",
  },
  {
    name: "llama3.2:3b",
    goodFor: "General reasoning with strong instruction following",
    minRamGb: 6,
    recommendedUse: "Versatile day-to-day analysis",
  },
  {
    name: "phi3.5:3.8b",
    goodFor: "Deeper analysis of complex attack chains",
    minRamGb: 8,
    recommendedUse: "Workstations with 8GB+ free",
  },
  {
    name: "qwen2.5:7b-instruct",
    goodFor: "High-accuracy classification and summaries",
    minRamGb: 12,
    recommendedUse: "Desktops with discrete RAM headroom",
  },
  {
    name: "llama3.1:8b",
    goodFor: "Maximum reasoning depth for forensic review",
    minRamGb: 16,
    recommendedUse: "High-end workstations / servers",
  },
];

export function autoSelectModel(ramGb: number): OllamaModel {
  const fit = OLLAMA_MODELS.filter((m) => m.minRamGb <= ramGb);
  return fit.length ? fit[fit.length - 1] : OLLAMA_MODELS[0];
}
