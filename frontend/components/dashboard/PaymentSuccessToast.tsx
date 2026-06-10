"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export default function PaymentSuccessToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("payment") === "success") {
      toast.success("Payment successful! Your plan has been upgraded.", {
        duration: 6000,
      });
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  return null;
}
