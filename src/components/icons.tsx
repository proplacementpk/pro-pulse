/** A small set of line icons, drawn at whatever size the surrounding style gives them. */
const PATHS: Record<string, string> = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.8-3.8",
  upload: "M12 16V4m0 0L7 9m5-5 5 5M5 20h14",
  briefcase: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  settings: "M5 7h6m4 0h4M5 17h3m4 0h7M13 5v4M10 15v4",
  logout: "M10 5H5v14h5M15 8l4 4-4 4M19 12H9",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19",
  x: "M6 6l12 12M18 6 6 18",
  back: "M14.5 6l-6 6 6 6",
  next: "M9.5 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  phone: "M6 4h4l1.5 5-2 1.5a12 12 0 0 0 4 4l1.5-2 5 1.5v4c-9 .5-15.500-6-14-14z",
  pin: "M12 21s-6.500-6-6.500-11a6.500 6.500 0 0 1 13 0c0 5-6.500 11-6.500 11zM12 8a2.200 2.200 0 1 0 0 4.400A2.200 2.200 0 0 0 12 8z",
  link: "M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1",
  file: "M7 3h7l4 4v14H7zM14 3v4h4",
  filter: "M4 6h16M7 12h10M10 18h4",
  download: "M12 4v11m0 0-4.500-4.500M12 15l4.500-4.500M5 20h14",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6",
  users: "M9 5a3.200 3.200 0 1 0 0 6.400A3.200 3.200 0 0 0 9 5zM3 20a6 6 0 0 1 12 0M16 5.500a3 3 0 0 1 0 5.800M17.500 14.500A5.500 5.500 0 0 1 21 20",
  note: "M5 4h14v12l-4 4H5zM15 20v-4h4M8 9h8M8 13h5",
  more: "M5.500 12h.01M12 12h.01M18.500 12h.01",
};

export function Icon({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] || ""} />
    </svg>
  );
}

/** The logo, in the version that suits the current light or dark mode. */
export function Logo({ width = 150 }: { width?: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-light" src="/logo.svg" alt="Propulse" width={width} height={Math.round(width * 417 / 1812)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo-dark" src="/logo-dark.svg" alt="Propulse" width={width} height={Math.round(width * 417 / 1812)} />
    </>
  );
}

/** The heartbeat line from the logo. */
export const PULSE = "M2 30h52l10-9 9 9h14l9-26 12 40 9-22h61";
