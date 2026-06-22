import { IM_Fell_English, Playfair_Display, PT_Mono, Special_Elite, UnifrakturMaguntia } from 'next/font/google';
import DemoClient from './DemoClient';
import './demo.css';
import { publicMetadata } from '../seo';

const typewriter = Special_Elite({ subsets: ['latin'], weight: '400', variable: '--font-typewriter', display: 'swap' });
const serif = Playfair_Display({ subsets: ['latin', 'cyrillic'], variable: '--font-serif', display: 'swap' });
const oldprint = IM_Fell_English({ subsets: ['latin'], weight: ['400'], style: ['normal', 'italic'], variable: '--font-oldprint', display: 'swap' });
const blackletter = UnifrakturMaguntia({ subsets: ['latin'], weight: '400', variable: '--font-blackletter', display: 'swap' });
const ptmono = PT_Mono({ subsets: ['latin', 'cyrillic'], weight: '400', variable: '--font-ptmono', display: 'swap' });

export const metadata = publicMetadata({
  title: 'Barri Demo — Play the AI Case Curator',
  description: 'Try a short playable Barri preview in your browser. Tell the AI Case Curator what you do, inspect the room, and find your way into the secret archive.',
  path: '/demo',
});

export default function DemoPage() {
  return (
    <div className={`${typewriter.variable} ${serif.variable} ${oldprint.variable} ${blackletter.variable} ${ptmono.variable} demo-root`}>
      <DemoClient />
    </div>
  );
}
