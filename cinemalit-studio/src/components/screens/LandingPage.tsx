// src/components/screens/LandingPage.tsx — Public marketing landing page
import { useEffect, useRef, useState } from 'react';
import {
  Clapperboard, ArrowRight, FileText, ListChecks, CalendarDays, UploadCloud,
  Wallet, Clipboard, Image, Sparkles, Database, Bot, Workflow,
  ShieldCheck, ScrollText, PauseCircle, MessageSquare, Layers,
  LayoutGrid,
} from 'lucide-react';
import { useStudioStore } from '../../store/studio';
import { Button } from '../ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { WorkbenchShowcase } from './WorkbenchShowcase';
import styles from './LandingPage.module.css';

/** Fades a section's children in, staggered, the first time it scrolls into
 *  view. One observer per section (not per card) — cheap, and the reveal is
 *  a real state (seen vs. not-yet-seen), not decoration with no state behind
 *  it. No-ops under prefers-reduced-motion. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, visible };
}

const PIPELINE = [
  { n: '01', title: 'Upload a script', desc: 'Drop in a screenplay and the Director Agent splits it into scenes automatically — no manual tagging.', icon: UploadCloud },
  { n: '02', title: 'Get a full breakdown', desc: 'Synopsis, INT/EXT, cast, props, wardrobe, VFX/SFX and stunts — costed per scene, grounded in the actual script text.', icon: Layers },
  { n: '03', title: 'Storyboards, on request', desc: 'Timed AI keyframes per scene — camera spec, lens, and a generated cinematic still for each shot.', icon: Image },
  { n: '04', title: 'Budget reconciles itself', desc: 'Every budget line is derived straight from the breakdown, so the two can never disagree.', icon: Wallet },
  { n: '05', title: 'Scenes become a schedule', desc: 'Shoot days are packed by location and time of day into a stripboard, with a day-out-of-days grid per character.', icon: CalendarDays },
];

const FEATURE_GROUPS = [
  {
    label: 'Understand the script',
    items: [
      { icon: LayoutGrid, title: 'Scene Canvas', desc: 'Every scene as a draggable node — number, slugline, page count, risk badge, cast and shoot day.' },
      { icon: FileText, title: 'Screenplay', desc: 'Reader mode and a Fountain editor. Edit the script and sync — the same agent re-runs the full breakdown.' },
      { icon: ListChecks, title: 'Breakdown', desc: 'One card per scene: cast, props, wardrobe, VFX and SFX — colour-coded by INT/EXT and time of day.' },
    ],
  },
  {
    label: 'Plan the shoot',
    items: [
      { icon: CalendarDays, title: 'Stripboard', desc: 'Scenes as coloured strips grouped by shoot day, with a day-out-of-days grid per character.' },
      { icon: Clipboard, title: 'Shot List', desc: 'Every shot — type, angle, movement, lens, status — linked to its storyboard frame.' },
      { icon: Wallet, title: 'Budget', desc: 'The topsheet. Every line derived from the breakdown, so it always reconciles against the cap.' },
    ],
  },
  {
    label: 'Direct with AI',
    items: [
      { icon: Image, title: 'Storyboards', desc: 'Timed AI keyframes for every scene — camera spec, lens, and a generated still per frame.' },
      { icon: MessageSquare, title: 'Director Agent', desc: 'Chat scoped to the active project. Ask about your most expensive scene and get a real answer.' },
    ],
  },
];

const ARCHITECTURE = [
  { icon: Bot, title: 'Director Agent', desc: 'One root agent, 17 tools — reads and writes the production database, runs the ingest, answers questions.' },
  { icon: Workflow, title: 'Schema-constrained sub-agents', desc: 'Breakdown and storyboard generation each hand off to a dedicated sub-agent that can only return structured data — no free-text drift.' },
  { icon: Sparkles, title: 'Gemini image model', desc: 'Every storyboard prompt is rendered into an actual cinematic still, not a placeholder sketch.' },
  { icon: Database, title: 'ClickHouse Cloud', desc: 'Every scene, cast member, budget line and shot lands as a row — queryable with SQL, not trapped in a chat transcript.' },
];

const TRUST = [
  { icon: ShieldCheck, title: 'Approval gates', desc: 'Budget cap, stunt & FX safety and location permit gates stand between a proposal and a greenlight.' },
  { icon: ScrollText, title: 'Audit log', desc: 'Every consequential agent action is recorded — who approved what, and when.' },
  { icon: PauseCircle, title: 'Partial beats failure', desc: 'If a scene fails to break down, the run finishes with everything that worked — never nothing.' },
];

const FAQ = [
  { q: 'What script formats can I upload?', a: '.fountain, .txt, .md, Final Draft (.fdx), or a PDF with selectable text — parsed in your browser before anything is sent.' },
  { q: 'Where does my production data live?', a: 'Every scene, cast member, budget line and shot is a row in ClickHouse Cloud — queryable with SQL from inside the app, not locked in a chat transcript.' },
  { q: 'Does the agent ever invent things that aren’t in my script?', a: 'No. It’s instructed to base every character, prop and beat on what’s actually written in the scene text — never to invent one that doesn’t appear.' },
  { q: 'What happens if a scene fails to break down?', a: 'The run finishes partial rather than failing outright — you get the scenes that succeeded, clearly marked, instead of nothing.' },
  { q: 'Can I edit what the agent generates?', a: 'Yes. Breakdown, budget, stripboard and shot list are all editable. The agent proposes; you approve.' },
  { q: 'Why ClickHouse?', a: 'CinemaLit was built for the Google Gemini + ClickHouse "Agentic Cinema" track. ClickHouse is the memory engine behind every view here, not storage bolted on after the fact.' },
];

export function LandingPage() {
  const { setScreen, setAuthTab } = useStudioStore();

  const goToAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab);
    setScreen('login');
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          <div className={styles.brandMark}><Clapperboard size={20} /></div>
          <span className={styles.brandName}>Cinema<span>Lit</span> Studio</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#product" className={styles.navLink}>Product</a>
          <a href="#how-it-works" className={styles.navLink}>How it works</a>
          <a href="#architecture" className={styles.navLink}>Under the hood</a>
          <a href="#faq" className={styles.navLink}>FAQ</a>
        </div>
        <div className={styles.navActions}>
          <Button variant="ghost" size="sm" className={styles.navSignIn} onClick={() => goToAuth('login')}>Sign In</Button>
          <Button size="sm" onClick={() => goToAuth('register')}>
            Get Started <ArrowRight size={14} />
          </Button>
        </div>
      </nav>

      {/* ---------- Hero ---------- */}
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <div className={styles.badge}><Sparkles size={13} /> Built for Google Gemini + ClickHouse — Agentic Cinema</div>
          <h1 className={styles.heroTitle}>Agentic pre-production, from script to shoot day.</h1>
          <p className={styles.heroSub}>
            Upload a screenplay. Get a costed scene breakdown, shot list, budget and shooting
            schedule — reasoned end to end by an autonomous Director Agent, stored in ClickHouse,
            and explorable in a film-tool-shaped workbench.
          </p>
          <div className={styles.heroActions}>
            <Button size="lg" onClick={() => goToAuth('register')}>
              Start a Project <ArrowRight size={16} />
            </Button>
            <Button size="lg" variant="outline" onClick={() => goToAuth('login')}>Sign In</Button>
          </div>
          <p className={styles.heroFinePrint}>A 30-scene script goes from upload to a fully populated production database in minutes.</p>
        </div>
      </header>

      {/* ---------- Workbench showcase ---------- */}
      <section className={styles.showcase}>
        <WorkbenchShowcase />
      </section>

      {/* ---------- Tech / track strip ---------- */}
      <section className={styles.stackStrip}>
        <span className={styles.stackItem}><Bot size={14} /> Google ADK Director Agent</span>
        <span className={styles.stackItem}><Sparkles size={14} /> Gemini</span>
        <span className={styles.stackItem}><Database size={14} /> ClickHouse Cloud</span>
        <span className={styles.stackItem}><Workflow size={14} /> React 19 + TypeScript</span>
      </section>

      {/* ---------- Problem / thesis ---------- */}
      <section className={styles.thesis}>
        <div className={styles.thesisCol}>
          <span className={styles.thesisLabel}>The problem</span>
          <h2 className={styles.thesisHeading}>Pre-production is a week of clerical work before anyone shoots anything.</h2>
          <p className={styles.thesisBody}>
            A 1st AD reads the script line by line and hand-builds a scene breakdown, a shot list, a
            budget, a shooting schedule and call sheets — all of it derivable from the script, none
            of it derived automatically in existing tools.
          </p>
        </div>
        <div className={styles.thesisCol}>
          <span className={styles.thesisLabel}>The inversion</span>
          <h2 className={styles.thesisHeading}>The Director states intent. The agent does the reasoning.</h2>
          <p className={styles.thesisBody}>
            The script is the only required input. Every meaningful write to the production
            database goes through the Director Agent — the workbench is a view of what it produced,
            and a place to correct it.
          </p>
        </div>
      </section>

      {/* ---------- How it works — pipeline cards with a real-UI echo ---------- */}
      <PipelineSection />

      {/* ---------- Product deep-dive — vertical feature cards ---------- */}
      <ProductSection />

      {/* ---------- Under the hood — connected timeline ---------- */}
      <ArchitectureSection />

      {/* ---------- Governance / trust — horizontal row cards ---------- */}
      <TrustSection />

      {/* ---------- FAQ ---------- */}
      <section id="faq" className={styles.faq}>
        <h2 className={styles.sectionTitle}>Frequently asked</h2>
        <Accordion type="single" collapsible className={styles.faqAccordion}>
          {FAQ.map((item, i) => (
            <AccordionItem key={item.q} value={`item-${i}`} className={styles.faqItem}>
              <AccordionTrigger className={styles.faqTrigger}>{item.q}</AccordionTrigger>
              <AccordionContent className={styles.faqAnswer}>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className={styles.finalCta}>
        <h2 className={styles.finalCtaTitle}>Upload a script. See the whole shoot take shape.</h2>
        <Button size="lg" onClick={() => goToAuth('register')}>
          Start a Project <ArrowRight size={16} />
        </Button>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <div className={styles.brandMark}><Clapperboard size={16} /></div>
            <span>Cinema<span>Lit</span> Studio</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="#product">Product</a>
            <a href="#how-it-works">How it works</a>
            <a href="#architecture">Under the hood</a>
            <a href="#faq">FAQ</a>
            <a href="https://github.com/whitechart-studio/CinemaLit" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>Built for the Google Gemini + ClickHouse &ldquo;Agentic Cinema&rdquo; track.</span>
        </div>
      </footer>
    </div>
  );
}

/** Small real-UI echo per pipeline stage — the same visual language as the
 *  WorkbenchShowcase, shrunk into a footer strip, so "how it works" reads as
 *  a picture of the product instead of five paragraphs. */
function PipelineEcho({ n }: { n: string }) {
  switch (n) {
    case '01':
      return (
        <div className={styles.echoUpload}>
          <UploadCloud size={13} /> <span>neon_echoes.fountain</span>
        </div>
      );
    case '02':
      return (
        <div className={styles.echoTags}>
          {['CAST', 'PROPS', 'VFX'].map((t) => <span key={t} className={styles.echoTag}>{t}</span>)}
        </div>
      );
    case '03':
      return <div className={styles.echoFrame}>50mm · Dolly In · 0:00–0:04</div>;
    case '04':
      return (
        <div className={styles.echoBudget}>
          <span>VFX / SFX · $1,850</span>
          <span className={styles.echoBadgeOver}>OVER</span>
        </div>
      );
    default:
      return <div className={styles.echoStrip}>Day 1 — Neon Coffee Shop · Diner Alleyway</div>;
  }
}

function PipelineSection() {
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section id="how-it-works" ref={ref} className={`${styles.pipeline} ${styles.revealGroup} ${visible ? styles.visible : ''}`}>
      <h2 className={styles.sectionTitle}>How it works</h2>
      <div className={styles.pipelineGrid}>
        {PIPELINE.map((step) => (
          <div key={step.n} className={styles.pipelineCard}>
            <div className={styles.pipelineCardTop}>
              <span className={styles.stepNum}>{step.n}</span>
              <div className={styles.pipelineIcon}><step.icon size={16} /></div>
            </div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
            <PipelineEcho n={step.n} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductSection() {
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section id="product" ref={ref} className={`${styles.product} ${styles.revealGroup} ${visible ? styles.visible : ''}`}>
      <h2 className={styles.sectionTitle}>Multiple views, one project</h2>
      <p className={styles.sectionSub}>Agent chat on the left, tabbed views in the centre, inspector on the right — every screen reads from the same production database.</p>
      {FEATURE_GROUPS.map((group) => (
        <div key={group.label} className={styles.featureGroup}>
          <h3 className={styles.featureGroupLabel}>{group.label}</h3>
          <div className={styles.grid}>
            {group.items.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureCardIcon}><f.icon size={18} /></div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function ArchitectureSection() {
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section id="architecture" ref={ref} className={`${styles.architecture} ${styles.revealGroup} ${visible ? styles.visible : ''}`}>
      <h2 className={styles.sectionTitle}>Under the hood</h2>
      <p className={styles.sectionSub}>The Director Agent runs on Google ADK. Every write lands in ClickHouse Cloud, the product&apos;s memory engine.</p>
      <div className={styles.archFlow}>
        {ARCHITECTURE.map((a) => (
          <div key={a.title} className={styles.archStep}>
            <div className={styles.archIcon}><a.icon size={18} /></div>
            <div>
              <h4>{a.title}</h4>
              <p>{a.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrustSection() {
  const { ref, visible } = useReveal<HTMLElement>();
  return (
    <section ref={ref} className={`${styles.trust} ${styles.revealGroup} ${visible ? styles.visible : ''}`}>
      <div className={styles.rowCards}>
        {TRUST.map((t) => (
          <div key={t.title} className={styles.rowCard}>
            <div className={styles.rowCardIcon}><t.icon size={18} /></div>
            <div>
              <h4>{t.title}</h4>
              <p>{t.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
