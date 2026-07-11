import { TramesTabs } from "./TramesTabs";

export default function TramesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <TramesTabs />
      {children}
    </div>
  );
}
