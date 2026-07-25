"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { effectiveConsent } from "@/lib/consent";

function initMetaPixel(pixelId) {
  if (window.fbq) return;
  /** @type {Window["fbq"]} */
  const fbq = function (...args) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = window._fbq || fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  window.fbq("init", pixelId);
}

// gtag.js is a shared loader — one script tag can serve multiple
// config()'d destinations (a GA4 property, an Ads conversion ID, etc).
function initGoogleTag(ga4Id, adsConversionId) {
  if (window.gtag) {
    if (adsConversionId) window.gtag("config", adsConversionId);
    return;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  // Consent Mode v2 default. The tag only loads once consent resolves to
  // "granted" (by regional default or explicit accept), so the default here
  // is always granted — but Google requires the signal to be declared
  // before config for Ads features to work.
  window.gtag("consent", "default", {
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
    analytics_storage: "granted",
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", ga4Id);
  if (adsConversionId) window.gtag("config", adsConversionId);
}

// Loads Meta Pixel / Google tags when consent resolves to "granted"
// (default for non-opt-in regions, explicit accept elsewhere), and fires
// one PageView-equivalent per route change.
export default function AdPixels() {
  const pathname = usePathname();

  useEffect(() => {
    if (effectiveConsent() !== "granted") return;

    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (pixelId) initMetaPixel(pixelId);

    const ga4Id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
    if (ga4Id) initGoogleTag(ga4Id, process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID);
  }, []);

  useEffect(() => {
    if (effectiveConsent() !== "granted") return;

    window.fbq?.("track", "PageView");
    if (process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) window.gtag?.("event", "page_view");
  }, [pathname]);

  return null;
}
