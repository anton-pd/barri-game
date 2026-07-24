import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const demoClient = readFileSync(new URL('../src/app/demo/DemoClient.tsx', import.meta.url), 'utf8');
const demoCss = readFileSync(new URL('../src/app/demo/demo.css', import.meta.url), 'utf8');

describe('demo first-turn and privacy affordances', () => {
  it('renders exactly the existing three localized initial actions before the first turn', () => {
    expect(demoClient).toContain('userMessages === 0');
    expect(demoClient).toContain('copy.suggestions.initial.map');
    expect(demoClient).toContain('copy.suggestionsHint');
    expect(demoClient).toContain("initial: ['Inspect the brass door', 'Search the intake desk', 'Listen at the keyhole']");
    expect(demoClient).toContain("initial: ['Оглянути латунні двері', 'Обшукати стіл реєстрації', 'Послухати біля замкової щілини']");
    expect(demoClient).toContain("initial: ['Inspeccionar la puerta de latón', 'Registrar el escritorio', 'Escuchar por la cerradura']");
  });

  it('starts the timer only after an accepted user turn', () => {
    expect(demoClient).toContain('const [hasStarted, setHasStarted] = useState(false)');
    expect(demoClient).toContain('if (!hasStarted || chatClosedReason) return undefined');
    expect(demoClient).toContain('setHasStarted(true)');
    expect(demoClient).toContain('setHasStarted(false)');
  });

  it('shows neutral privacy information with real legal links and responsive action chips', () => {
    expect(demoClient).toContain('<Link href="/privacy">');
    expect(demoClient).toContain('<Link href="/terms">');
    expect(demoClient).toContain('We use your email to manage this waiting-list request.');
    expect(demoCss).toContain('.demo-suggestions');
    expect(demoCss).toContain('flex-wrap: wrap');
  });
});
