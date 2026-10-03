import React, { useEffect, useRef, useState } from 'react';

/**
 * A shopping bag that shows what's in it: an empty outline when the cart is
 * empty, and a course book sticking out of a tinted bag when it isn't. When
 * the count goes up, the book drops in and the bag bounces.
 */
export const CartIcon = ({ count, size = 16 }) => {
  const prev = useRef(count);
  const [drop, setDrop] = useState(0); // bumps to restart the animation

  useEffect(() => {
    if (count > prev.current) setDrop((n) => n + 1);
    prev.current = count;
  }, [count]);

  const full = count > 0;
  return (
    <svg
      className={`cart-icon ${full ? 'is-full' : 'is-empty'}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g key={drop} className={drop ? 'cart-bounce' : undefined}>
        <path className="cart-handle" d="M9 8V6.6a3 3 0 0 1 6 0V8" />
        {/* the book sits over the handle but behind the bag's front, so it looks tucked inside */}
        {full && (
          <g className={drop ? 'cart-book is-dropping' : 'cart-book'}>
            <rect x="9.2" y="2.6" width="6" height="8" rx="1" transform="rotate(12 12.2 6.6)" />
            <path d="M11 4.6 l3 0.65" transform="rotate(12 12.2 6.6)" />
          </g>
        )}
        <path className="cart-bag" d="M5.2 8h13.6l-1 11.4a1.8 1.8 0 0 1-1.8 1.6H8a1.8 1.8 0 0 1-1.8-1.6z" />
      </g>
    </svg>
  );
};
