import "./config/env.js";
import { createMobileApp } from "./mobileApp.js";

createMobileApp().listen(Number(process.env.PENSIEVE_MOBILE_PORT || 3003), "127.0.0.1", () => console.log("Pensieve phone preview API ready"));
