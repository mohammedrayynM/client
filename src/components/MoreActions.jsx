import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * Three-dot / "more options" menu for admin & owner tables.
 *
 * The menu is rendered in a portal on document.body with fixed positioning. An absolutely positioned dropdown inside a
 * table cell is clipped by any ancestor with overflow (table wrappers, cards, scroll areas), which is why the menu used
 * to appear cut off, hidden behind rows, or unreachable on mobile. Here it is positioned from the button's rectangle,
 * flips upward near the bottom of the viewport, stays inside the viewport horizontally, closes on outside tap, Escape,
 * scroll and resize, and each item can only fire once per open.
 */
const MENU_WIDTH = 190;
const ITEM_HEIGHT = 44; // comfortable touch target

export default function MoreActions({ actions = [], align = 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const firedRef = useRef(false);

  const visibleActions = actions.filter((action) => action && !action.hidden);
  const close = useCallback(() => setIsOpen(false), []);

  const place = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuH = menuRef.current ? menuRef.current.offsetHeight : visibleActions.length * ITEM_HEIGHT + 8;
    const width = Math.min(MENU_WIDTH, vw - 16);
    let left = align === 'left' ? r.left : r.right - width;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const below = vh - r.bottom - 8;
    const openUp = below < menuH && r.top > below;
    const top = openUp ? Math.max(8, r.top - menuH - 4) : Math.min(r.bottom + 4, Math.max(8, vh - menuH - 8));
    setPos({ top, left, width });
  }, [align, visibleActions.length]);

  useLayoutEffect(() => { if (isOpen) place(); }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (buttonRef.current && buttonRef.current.contains(e.target)) return;
      close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true); // any scrolling ancestor: the fixed menu would otherwise drift away from its row
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [isOpen, close]);

  if (visibleActions.length === 0) return null;

  const toggle = (e) => {
    e.stopPropagation();
    firedRef.current = false;
    setIsOpen((v) => !v);
  };

  const run = (action) => (e) => {
    e.stopPropagation();
    if (action.disabled || firedRef.current) return;
    firedRef.current = true; // a double tap cannot run the action twice
    setIsOpen(false);
    if (action.onClick) action.onClick();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="more-actions-btn"
        onClick={toggle}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="More options"
        style={{
          background: isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: 8,
          color: isOpen ? '#fff' : 'var(--text-muted, #94a3b8)',
          cursor: 'pointer',
          minWidth: 44,
          minHeight: 44,
          fontSize: 18,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'manipulation',
        }}
      >
        &#8942;
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="more-actions-dropdown"
          style={{
            position: 'fixed',
            top: pos ? pos.top : -9999,
            left: pos ? pos.left : -9999,
            width: pos ? pos.width : MENU_WIDTH,
            visibility: pos ? 'visible' : 'hidden',
            zIndex: 100000,
            backgroundColor: '#111625',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 10,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
            padding: 4,
            maxHeight: 'calc(100vh - 16px)',
            overflowY: 'auto',
          }}
        >
          {visibleActions.map((action, index) => (
            <button
              key={action.key || index}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={run(action)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                minHeight: ITEM_HEIGHT,
                padding: '0 14px',
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                border: 'none',
                borderRadius: 6,
                background: 'transparent',
                color: action.danger ? '#ef4444' : action.disabled ? '#64748b' : '#e2e8f0',
                cursor: action.disabled ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation',
              }}
              onMouseEnter={(e) => { if (!action.disabled) e.currentTarget.style.backgroundColor = action.danger ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {action.icon && <span style={{ fontSize: 14 }}>{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
