import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import "@rainbow-me/rainbowkit/styles.css";
import "@fontsource/gloock/latin-400.css";
import "@fontsource-variable/geist/wght.css";
import { config } from "./wagmi";
import App from "./App";
import { ToastProvider } from "./components/Toasts";
import "./styles/tokens.css";
import "./App.css";

const queryClient = new QueryClient();

const theme = darkTheme({
  accentColor: "#E6C27A",
  accentColorForeground: "#1B1407",
  borderRadius: "large",
  overlayBlur: "small",
});
theme.fonts.body = '"Geist Variable", ui-sans-serif, system-ui, sans-serif';
theme.colors.modalBackground = "#0C1D17";
theme.colors.modalBorder = "rgba(230, 194, 122, 0.16)";
theme.colors.connectButtonBackground = "#10261E";
theme.colors.actionButtonBorder = "rgba(230, 194, 122, 0.18)";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
              <ToastProvider>
                <App />
              </ToastProvider>
            </MotionConfig>
          </LazyMotion>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>
);
