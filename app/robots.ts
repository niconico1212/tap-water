import type { MetadataRoute } from "next";
import { STATE_NAMES } from "@/lib/text";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/data/", "/share/"] }],
    sitemap: ["core", ...Object.keys(STATE_NAMES)].map((id) => `${SITE_URL}/sitemap/${id}.xml`),
  };
}
