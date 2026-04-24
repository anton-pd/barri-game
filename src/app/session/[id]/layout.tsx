import type { ReactNode } from 'react';
import {
  Special_Elite,
  Playfair_Display,
  IM_Fell_English,
  UnifrakturMaguntia,
  PT_Mono,
  PT_Serif,
} from 'next/font/google';
import '../../landing.css';
import './chat.css';

const typewriter = Special_Elite({
  weight: '400',
  subsets: ['latin', 'latin-ext'],
  variable: '--font-specia',
  display: 'swap',
});

const serif = Playfair_Display({
  weight: ['400', '600', '700'],
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-playfair',
  display: 'swap',
});

const oldprint = IM_Fell_English({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin', 'latin-ext'],
  variable: '--font-imfell',
  display: 'swap',
});

const blackletter = UnifrakturMaguntia({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-unifrak',
  display: 'swap',
});

const ptmono = PT_Mono({
  weight: '400',
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-ptmono',
  display: 'swap',
});

const ptserif = PT_Serif({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-ptserif',
  display: 'swap',
});

export default function SessionLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        typewriter.variable,
        serif.variable,
        oldprint.variable,
        blackletter.variable,
        ptmono.variable,
        ptserif.variable,
        'landing-root',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
