"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#0f1422",
          border: "1px solid #1c2438",
          color: "#e6e9f2",
        },
      }}
    />
  );
}
