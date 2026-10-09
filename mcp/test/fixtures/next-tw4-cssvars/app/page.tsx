import { Badge } from "@/components/Badge";

function cn(...a: unknown[]) {
  return a.filter(Boolean).join(" ");
}

export default function Page({ status }: { status: string }) {
  return (
    <main className="flex flex-col gap-4 p-[16px]">
      <h1 className="title text-[22px]">Shop</h1>
      <p className="text-[length:12px] bg-[#ff00aa]">Promo</p>
      <span className={`pill pill-${status}`} style={{ color: "#333", borderColor: "var(--color-line)" }}>x</span>
      <div className={cn("rounded-[8px]", status && "shadow-[0_1px_2px_rgba(0,0,0,.2)]")}>y</div>
      <svg fill="#000"><path stroke="currentColor" /></svg>
      <a className="text-[var(--color-primary)]">link</a>
      <a className="text-[var(--color-brand)]">bad</a>
      <Badge />
    </main>
  );
}
