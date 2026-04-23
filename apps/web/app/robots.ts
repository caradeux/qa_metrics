import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/admin",
          "/assignments",
          "/audit",
          "/clients",
          "/equipo",
          "/gantt",
          "/mi-semana",
          "/projects",
          "/records",
          "/reports",
          "/settings",
          "/users",
        ],
      },
    ],
    sitemap: "https://qametrics.cl/sitemap.xml",
    host: "https://qametrics.cl",
  };
}
