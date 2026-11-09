// BERBERIX ikon seti: SF Symbols tarzinda ince cizgi ikonlar (emoji yerine).
// Kullanim: <Icon name="calendar" /> ; boyut ve renk yaziya uyar (1em, currentColor).
const P = {
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.8c1.6.6 2.7 2.2 3 4.7" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13.5" rx="3" /><path d="M3 10h18M16.5 14.5h1.5" /><path d="M6 6l9.5-2.6a1.6 1.6 0 0 1 2 1.2L18 6" /></>,
  sparkles: <><path d="M10 3.5l1.6 4.4L16 9.5l-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6z" /><path d="M17.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" /></>,
  person: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20c.8-3.8 3.6-6 7.2-6s6.4 2.2 7.2 6" /></>,
  phone: <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2.1 2.1 0 0 1-2.3 2.1C10.4 19 5 13.6 4.5 5.8a2.1 2.1 0 0 1 2.1-2.3z" />,
  message: <path d="M4 12a8 7 0 1 1 3.4 5.7L4 19l1.1-3.1A6.6 6.6 0 0 1 4 12z" />,
  pin: <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  scissors: <><circle cx="6.5" cy="17" r="2.8" /><circle cx="6.5" cy="7" r="2.8" /><path d="M8.8 8.6L20 18M8.8 15.4L20 6" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.3l2.8 2.8L16.3 9.5" /></>,
  chevronRight: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  chevronLeft: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14.5 8.5l2 2" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>,
  star: <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />,
  warning: <><path d="M12 4l9 15.5H3z" /><path d="M12 10v4.2M12 17.2v.1" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  note: <><path d="M5 3.5h10l4 4v13H5z" /><path d="M15 3.5v4h4M8.5 12h7M8.5 15.5h7" /></>,
  arrows: <path d="M4 8.5h14l-3.5-3.5M20 15.5H6l3.5 3.5" />,
  cash: <><rect x="2.5" y="6.5" width="19" height="11" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v5M18 9.5v5" /></>,
  card: <><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M2.5 10h19M6 14.5h3.5" /></>,
  bank: <><path d="M3 9.5L12 4l9 5.5z" /><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3 20h18" /></>,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="M8.8 12.2l2.3 2.3 4.2-4.3" /></>,
  palette: <><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.8-1 1.4-2-.5-1.2.3-2.5 1.7-2.5h1.9a3.5 3.5 0 0 0 3.5-3.5C20.5 7.6 16.7 3.5 12 3.5z" /><circle cx="7.8" cy="11" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15" cy="7.8" r="1" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  share: <><path d="M12 15V3.5M8 7.5l4-4 4 4" /><path d="M6 11v8.5h12V11" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" /></>,
  logout: <><path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" /><path d="M10.5 12H20M16.5 8.5L20 12l-3.5 3.5" /></>,
  history: <><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" /><path d="M4.5 4.5V9H9M12 8v4.3l2.8 1.7" /></>,
  sliders: <path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1M16 4v4M10 10v4M18 16v4" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.1" /></>,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  sparkle: <path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z" />,
};

export default function Icon({ name, size = "1.15em", stroke = 1.6, className = "", title }) {
  const path = P[name];
  if (!path) return null;
  return (
    <svg
      className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {path}
    </svg>
  );
}

// Marka isareti: sade kelime logo
export function Wordmark({ className = "" }) {
  return <span className={`wordmark ${className}`}>BERBERİX</span>;
}
