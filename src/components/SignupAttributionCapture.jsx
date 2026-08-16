"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureSignupAttribution } from "../lib/signupAttribution";

export default function SignupAttributionCapture() {
  const pathname = usePathname();
  useEffect(() => { captureSignupAttribution(); }, [pathname]);
  return null;
}
