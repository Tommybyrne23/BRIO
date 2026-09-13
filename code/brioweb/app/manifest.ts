import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Brio — training, nutrition and recovery",
    short_name: "Brio",
    description: "A decision-led training, nutrition and recovery workspace.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F7F5F0",
    theme_color: "#F7F5F0",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
