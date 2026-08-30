"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/lib/analytics";
import { captureFirstTouchAttribution } from "@/lib/lead-client";
export default function FunnelIntentTracker(){const pathname=usePathname();useEffect(()=>{captureFirstTouchAttribution();track("landing_page_viewed");const timer=setTimeout(()=>track("page_engaged"),30_000);return()=>clearTimeout(timer);},[pathname]);return null;}
