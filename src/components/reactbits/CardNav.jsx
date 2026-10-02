// CardNav from React Bits (https://reactbits.dev), adapted for the Tutor's side panel:
// the bar shows the current tool; the menu button expands it into one card per
// tool (GSAP height + staggered cards, as in the original). Picking a card
// selects it and folds the menu away. Cards stack vertically because the panel
// is narrow; the logo slot holds a title and the CTA slot holds `actions`.
import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ArrowUpRight } from 'lucide-react';
import './CardNav.css';

const TOP_BAR = 52;

const CardNav = ({
  title,
  items,
  actions = null,
  className = '',
  ease = 'power3.out',
  baseColor = 'var(--bg-card)',
  menuColor = 'var(--text-primary)',
  ariaLabel = 'Menu'
}) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;
    const contentEl = navEl.querySelector('.card-nav-content');
    if (!contentEl) return 260;
    const was = {
      visibility: contentEl.style.visibility,
      pointerEvents: contentEl.style.pointerEvents,
      position: contentEl.style.position,
      height: contentEl.style.height
    };
    contentEl.style.visibility = 'visible';
    contentEl.style.pointerEvents = 'auto';
    contentEl.style.position = 'static';
    contentEl.style.height = 'auto';
    contentEl.offsetHeight; // force layout before measuring
    const contentHeight = contentEl.scrollHeight;
    Object.assign(contentEl.style, was);
    return TOP_BAR + contentHeight + 8;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: TOP_BAR, overflow: 'hidden' });
    gsap.set(cardsRef.current, { y: 18, opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    // quick and snappy: the panel opens in about a third of a second
    tl.to(navEl, { height: calculateHeight, duration: 0.24, ease });
    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.22, ease, stagger: 0.04 }, '-=0.12');
    return tl;
  };

  const itemsKey = (items || []).map((it) => it.id).join('|');
  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;
    return () => {
      tl?.kill();
      tlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, itemsKey]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;
      tlRef.current.kill();
      const newTl = createTimeline();
      if (!newTl) return;
      if (isExpanded) {
        gsap.set(navRef.current, { height: calculateHeight() });
        newTl.progress(1);
      }
      tlRef.current = newTl;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded]);

  const open = () => {
    const tl = tlRef.current;
    if (!tl || isExpanded) return;
    setIsHamburgerOpen(true);
    setIsExpanded(true);
    tl.eventCallback('onReverseComplete', null);
    tl.timeScale(1).play(0);
  };
  const close = () => {
    const tl = tlRef.current;
    if (!tl || !isExpanded) return;
    setIsHamburgerOpen(false);
    tl.eventCallback('onReverseComplete', () => setIsExpanded(false));
    tl.timeScale(1.6).reverse(); // closing is quicker still
  };
  const toggleMenu = () => (isExpanded ? close() : open());

  const setCardRef = (i) => (el) => {
    if (el) cardsRef.current[i] = el;
  };

  return (
    <div className={`card-nav-container ${className}`}>
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? 'open' : ''}`}
        style={{ backgroundColor: baseColor }}
        aria-label={ariaLabel}
        onKeyDown={(e) => { if (e.key === 'Escape' && isExpanded) { e.stopPropagation(); close(); } }}
      >
        <div className="card-nav-top">
          <button
            type="button"
            className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
            onClick={toggleMenu}
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            aria-expanded={isExpanded}
            style={{ color: menuColor }}
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>

          <div className="card-nav-title">{title}</div>

          {actions && <div className="card-nav-actions">{actions}</div>}
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded} inert={!isExpanded}>
          {(items || []).slice(0, 3).map((item, idx) => (
            <button
              type="button"
              key={item.id}
              className={`nav-card ${item.active ? 'is-active' : ''}`}
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
              aria-current={item.active ? 'true' : undefined}
              onClick={() => {
                item.onSelect?.();
                close();
              }}
            >
              <span className="nav-card-label">
                {item.icon}
                {item.label}
              </span>
              {item.description && (
                <span className="nav-card-link">
                  <ArrowUpRight className="nav-card-link-icon" size={12} aria-hidden="true" />
                  {item.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default CardNav;
