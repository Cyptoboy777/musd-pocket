import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p,
});

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 12.5l4.2 4.2L19 7" /></svg>);
export const IconAlert = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 8v5" /><path d="M12 16.5h.01" /><circle cx="12" cy="12" r="9" /></svg>);
export const IconInfo = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 7.5h.01" /></svg>);
export const IconX = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconCopy = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>);
export const IconExternal = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M14 5h5v5" /><path d="M19 5l-8 8" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></svg>);
export const IconLock = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></svg>);
export const IconUnlock = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 7.6-1.8" /></svg>);
export const IconUsers = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" /><path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" /></svg>);
export const IconSend = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 12l16-8-6 16-2.5-6.5L4 12z" /></svg>);
export const IconPlus = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconClock = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const IconBitcoin = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M8 6h6a3 3 0 0 1 0 6H8zM8 12h7a3 3 0 0 1 0 6H8zM8 6v12M10 4v2M13 4v2M10 18v2M13 18v2" /></svg>);
export const IconShield = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z" /><path d="M9 12l2.2 2.2L15.5 10" /></svg>);
export const IconCode = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 7l-5 5 5 5M15 7l5 5-5 5" /></svg>);
export const IconDeposit = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3v11" /><path d="M7.5 9.5L12 14l4.5-4.5" /><path d="M4 14v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" /></svg>);
