import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mezoTestnet } from "./lib/chains";

export const config = getDefaultConfig({
  appName: "MUSD Pocket",
  projectId: import.meta.env.VITE_WC_PROJECT_ID || "musd-pocket-demo-local",
  chains: [mezoTestnet],
  ssr: false,
});
