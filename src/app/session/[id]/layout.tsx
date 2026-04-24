import type { ReactNode } from 'react';
import { Special_Elite, Playfair_Display, IM_Fell_English, UnifrakturMaguntia, PT_Mono, PT_Serif } from 'next/font/google';
import '../../landing.css';
import './chat.css';

const typewriter = Special_Elite({ subsets: ['latin'], weight: '400', variable: '--font-specia', display: 'swap' });
const serif = Playfair_Display({ subsets: ['latin', 'cyrillic'], variable: '--font-playfair', display: 'swap' });
const oldprint = IM_Fell_English({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'], variable: '--font-imfell', display: 'swap' });
const blackletter = UnifrakturMaguntia({ subsets: ['latin'], weight: '400', variable: '--font-unifrak', display: 'swap' });
const ptmono = PT_Mono({ subsets: ['latin', 'cyrillic'], weight: '400', variable: '--font-ptmono', display: 'swap' });
const ptserif = PT_Serif({ subsets: ['latin', 'cyrillic'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-ptserif', display: 'swap' });

export default function SessionLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${typewriter.variable} ${serif.variable} ${oldprint.variable} ${blackletter.variable} ${ptmono.variable} ${ptserif.variable} landing-root`}>
      {children}
    </div>
  );
}
