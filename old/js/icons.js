// Simple line icons, drawn here (no outside artwork, no logos). 24x24, stroke only, so they follow the text colour in both light and dark.
const P = {
  home: "M4 11.5 12 4l8 7.5M6 10v9h12v-9M10 19v-5h4v5",
  goals: "M12 3v3M12 18v3M3 12h3M18 12h3M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  companies: "M5 20V5h9v15M14 10h5v10M3 20h18M8 8.5h3M8 12h3M8 15.5h3",
  outreach: "M20 4 10 14M20 4l-6 16-4-6-6-4 16-6Z",
  inbox: "M4 13l2.5-7h11L20 13M4 13v5h16v-5M4 13h5l1 2h4l1-2h5",
  pipeline: "M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z",
  history: "M4 12a8 8 0 1 0 2.4-5.7M4 5v4h4M12 8v4.5l3 1.5",
  stop: "M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7L8.5 3ZM8.5 12h7",
  run: "M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13ZM15.5 15.5 20 20",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17.5 19 7",
  branch: "M6 4v9M6 13a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 4a2 2 0 1 0 0 .01M18 8a2 2 0 1 0 0 .01M18 10c0 4-6 3-12 3",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  auto: "M12 3a9 9 0 1 0 0 18V3Z",
  back: "M15 5l-7 7 7 7",
  search: "M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13ZM15.5 15.5 20 20",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  refresh: "M20 11a8 8 0 0 0-14-4.5M4 4v4h4M4 13a8 8 0 0 0 14 4.5M20 20v-4h-4",
  logout: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20c0-3.5 3-6 7-6s7 2.5 7 6",
};

export function icon(name, size = 24) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", P[name] || P.more);
  svg.append(path);
  return svg;
}
