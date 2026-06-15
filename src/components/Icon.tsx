// Cohesive thin-stroke line-icon set for the game chat (ANT-163).
// Replaces colourful emoji so glyphs inherit currentColor and read as part of
// the noir dossier aesthetic. Sized in `em` so they scale with surrounding text.
export type IconName =
  | 'back' | 'stop' | 'dossier' | 'settings' | 'sound-on' | 'sound-off'
  | 'download' | 'play' | 'pause' | 'warning' | 'send' | 'pin'
  | 'inventory' | 'close' | 'retry' | 'plus' | 'equipped' | 'broken' | 'dice'
  | 'chevron-down';

export default function Icon({ name, className }: { name: IconName; className?: string }) {
  const common = {
    width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, 'aria-hidden': true,
    className: `chat-ico${className ? ' ' + className : ''}`,
  };
  switch (name) {
    case 'back':       return <svg {...common}><path d="M14 6l-6 6 6 6" /></svg>;
    case 'close':      return <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'plus':       return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'retry':      return <svg {...common}><path d="M20 11a8 8 0 10-2.3 6.4M20 20v-5h-5" /></svg>;
    case 'chevron-down': return <svg {...common}><path d="M6 9l6 6 6-6" /></svg>;
    case 'stop':       return <svg {...common} fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>;
    case 'play':       return <svg {...common} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5-11-6.5z" /></svg>;
    case 'pause':      return <svg {...common} fill="currentColor" stroke="none"><path d="M8 5h3v14H8zM13 5h3v14h-3z" /></svg>;
    case 'send':       return <svg {...common}><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
    case 'download':   return <svg {...common}><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" /></svg>;
    case 'warning':    return <svg {...common}><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4M12 17h.01" /></svg>;
    case 'pin':        return <svg {...common}><path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 10-13 0C5.5 15 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.2" /></svg>;
    case 'dossier':    return <svg {...common}><path d="M4 7a1 1 0 011-1h4l1.5 1.5H19a1 1 0 011 1V18a1 1 0 01-1 1H5a1 1 0 01-1-1V7z" /></svg>;
    case 'settings':   return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6" /></svg>;
    case 'sound-on':   return <svg {...common}><path d="M4 9v6h3l5 4V5L7 9H4z" /><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /></svg>;
    case 'sound-off':  return <svg {...common}><path d="M4 9v6h3l5 4V5L7 9H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></svg>;
    case 'inventory':  return <svg {...common}><rect x="4" y="8" width="16" height="11" rx="1" /><path d="M9 8V6.5A1.5 1.5 0 0110.5 5h3A1.5 1.5 0 0115 6.5V8" /></svg>;
    case 'equipped':   return <svg {...common}><path d="M5 5l5.5 5.5M14 14l5 5M14 5l-9 9M5 5l3 0 0 3" /></svg>;
    case 'broken':     return <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case 'dice':       return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" /></svg>;
    default:           return null;
  }
}
