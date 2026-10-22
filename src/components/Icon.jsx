/* Inline SVG icons (spec §8.4 "Icons"). One stroke set drawn on a 24-unit grid, coloured by
   currentColor, so an icon is the same glyph on every OS (emoji were not) and never a network
   request. Decorative by default (aria-hidden): the text next to it, or the button's aria-label,
   carries the meaning. Keep any asserted text node beside the icon, never inside it. */
const PATHS = {
  chevron: "M6 9l6 6 6-6",
  check: "M20 6L9 17l-5-5",
  close: "M18 6L6 18M6 6l12 12",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
  chart: "M18 20V10M12 20V4M6 20v-6",
  clipboard: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z",
  drop: "M12 2.7l5.7 6.3a7.5 7.5 0 1 1-11.4 0z",
  salt: "M8 9l1-7h6l1 7M8 9h8v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zM11 5h.01M13.5 5h.01M12 7.2h.01",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  print: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  people: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  "plus-circle": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v8M8 12h8",
  lightning: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  foot: "M12 22c-3 0-5-2.6-5-6.5S9 9 12 9s5 2.6 5 6.5-2 6.5-5 6.5zM6.5 7.5h.01M9 4.5h.01M12.5 3.5h.01M16 4.5h.01M18.5 7.5h.01",
  palette: "M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 22 10.9C21.9 6 17.5 2 12 2zM7.5 10.5h.01M10.5 6.5h.01M15.5 6.5h.01",
  sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  apple: "M16.4 12.6c0-2.3 1.9-3.4 2-3.5a4.3 4.3 0 0 0-3.3-1.8c-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8A4.5 4.5 0 0 0 5 9.6c-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.8-1-2.8-3.7zM14.2 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z",
  google: "M21 12h-9M21 12a9 9 0 1 1-2.6-6.4",
  facebook: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  download: "M12 3v12M7 10l5 5 5-5M5 21h14",
};

export default function Icon({ name, size = 16, className }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  );
}
