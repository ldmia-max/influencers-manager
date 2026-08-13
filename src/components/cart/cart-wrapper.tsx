"use client";

import { CartPanel } from "./cart-panel";
import { ServiceSelectionModal } from "./service-selection-modal";

interface CartWrapperProps {
  children: React.ReactNode;
}

export function CartWrapper({ children }: CartWrapperProps) {
  return (
    <>
      {children}
      <CartPanel />
      <ServiceSelectionModal />
    </>
  );
}
