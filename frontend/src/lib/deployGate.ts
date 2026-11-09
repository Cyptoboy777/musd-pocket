/** True only for a Vercel preview build. Production and local builds leave this false. */
declare const __DEPLOY_TOOL_ENABLED__: boolean;

export function isPreviewDeployTool(vercelEnv: string | undefined | null): boolean {
  return vercelEnv === "preview";
}

export function isDeployToolPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/deploy-tool";
}

export const DEPLOY_TOOL_ENABLED: boolean = __DEPLOY_TOOL_ENABLED__;
