"use client";
/** The few pieces that need to run in the browser. */
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "./icons";

/** A submit button that shows it is working and cannot be pressed twice. */
export function Submit({ children, busy, className = "btn primary", name, value }: {
  children: React.ReactNode; busy?: string; className?: string; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending && busy ? busy : children}
    </button>
  );
}

export function NavLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  const path = usePathname();
  const here = path === href || path.startsWith(href + "/") || (href === "/search" && path.startsWith("/candidates"));
  return (
    <Link href={href} aria-current={here ? "page" : undefined}>
      <Icon name={icon} /><span>{children}</span>
    </Link>
  );
}

/** Light or dark. Without a choice the portal follows the device. */
export function ThemeButton() {
  function flip() {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    root.dataset.theme = next;
    document.cookie = `pp_theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }
  return (
    <button type="button" className="btn small" onClick={flip} title="Switch between light and dark">
      <Icon name="sun" /><span>Theme</span>
    </button>
  );
}

/** A select that sends its form as soon as a choice is made (sort order, page size). */
export function AutoSelect({ name, value, options, label }: { name: string; value: string; options: [string, string][]; label: string }) {
  return (
    <select className="input" name={name} defaultValue={value} aria-label={label} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  );
}

/** The filter column. On a wide screen it is always there; on a phone it opens from a button,
 *  so the results come first. */
export function FilterPanel({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="filter-col">
      <button type="button" className="btn filter-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="filter" />{open ? "Hide filters" : "Filters"}{count ? <span className="count-badge">{count}</span> : null}
      </button>
      <div className={"panel filters" + (open ? " open" : "")}>
        <div className="filters-title"><span>Filters</span>{count ? <span className="count-badge" title="Filters in use">{count}</span> : null}</div>
        {children}
      </div>
    </div>
  );
}

/** The search form. It leaves empty boxes out of the address, so a search can be bookmarked or
 *  sent to a colleague as a short link. Without JavaScript it still works as a plain form. */
export function SearchForm({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget)) {
      const text = String(v).trim();
      if (!text) continue;
      if ((k === "skills_mode" && text === "all") || (k === "size" && text === "50")) continue;
      p.append(k, text);
    }
    if (!p.get("skills")) p.delete("skills_mode");
    if (p.get("sort") === (p.get("q") ? "match" : "updated")) p.delete("sort");
    const text = p.toString();
    router.push(text ? `/search?${text}` : "/search");
  }
  return <form action="/search" method="get" onSubmit={submit}>{children}</form>;
}
