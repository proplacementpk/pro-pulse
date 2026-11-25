import { PULSE } from "@/components/icons";

export default function Loading() {
  return (
    <div className="pulse-loader" role="status">
      <svg viewBox="0 0 180 48"><path d={PULSE} /></svg>
      <span>Loading</span>
    </div>
  );
}
