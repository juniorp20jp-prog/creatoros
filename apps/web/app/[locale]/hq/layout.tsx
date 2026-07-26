import type { ReactNode } from "react";

interface HqLayoutProps {
  children: ReactNode;
}

export default function HqLayout({ children }: HqLayoutProps) {
  return <>{children}</>;
}