import type { MetadataRoute } from "next";
import { DEPLOYMENT_BRAND } from "@/lib/deploymentBrand";

// Web App Manifest — lets the operator app be added to the home screen and
// launch full-screen (no browser chrome), like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${DEPLOYMENT_BRAND.name} Operator`,
    short_name: DEPLOYMENT_BRAND.name,
    description: `Booking and dispatch management for ${DEPLOYMENT_BRAND.name} operators.`,
    start_url: "/operator/today",
    id: "/operator/",
    scope: "/operator/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#04080f",
    theme_color: "#0B132B",
    icons: [
      { src: "/operator/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/operator/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/operator/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
