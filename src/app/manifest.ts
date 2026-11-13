import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blusk Leads",
    short_name: "Blusk",
    description: "Prospecção, CRM e projetos para freelancers criativos",
    start_url: "/hoje",
    display: "standalone",
    background_color: "#f7f8fa",
    theme_color: "#3443d9",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
