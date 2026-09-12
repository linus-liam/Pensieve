export const mobileMode = import.meta.env.VITE_MOBILE_MODE === "true";
export const localMode = mobileMode || import.meta.env.VITE_LOCAL_MODE === "true";
export const localToken = import.meta.env.VITE_LOCAL_TOKEN ?? "";
