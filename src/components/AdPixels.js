"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const CONSENT_KEY = "teamtastic_analytics_consent";

function initMetaPixel(pixelId) {
  if (window.fbq) return;
  const fbq = function fbq(...args) {
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

function initGoogleAds(conversionId) {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`;
  document.head.appendChild(script);

  window.gtag("js", new Date());
  window.gtag("config", conversionId);
}

// Loads Meta Pixel / Google Ads base tags only after explicit "granted"
// consent, and fires one PageView-equivalent per route change.
export default function AdPixels() {
  const pathname = usePathname();

  useEffect(() => {
    let consent;
    try {
      consent = window.localStorage.getItem(CONSENT_KEY);
    } catch {
      consent = null;
    }
    if (consent !== "granted") return;

    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    if (pixelId) initMetaPixel(pixelId);

    const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
    if (googleAdsId) initGoogleAds(googleAdsId);
  }, []);

  useEffect(() => {
    let consent;
    try {
      consent = window.localStorage.getItem(CONSENT_KEY);
    } catch {
      consent = null;
    }
    if (consent !== "granted") return;

    window.fbq?.("track", "PageView");
    if (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) window.gtag?.("event", "page_view");
  }, [pathname]);

  return null;
}
