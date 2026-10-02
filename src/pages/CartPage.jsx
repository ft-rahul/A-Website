import React from 'react';
import { formatPrice, formatPriceExact } from '../lib/money';
import { ShoppingBag, X, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getLessonCount } from '../data/catalog';
import { CourseMark } from '../components/CourseMark';

export const CartPage = () => {
  const { cart, removeFromCart, clearCart, startPurchaseFlow, navigateTo } = useApp();
  const total = cart.reduce((sum, c) => sum + c.price, 0);

  return (
    <div className="page">
      <div className="container">
        <header className="page-header">
          <p className="eyebrow is-accent">Checkout</p>
          <h1>Cart</h1>
          <p>One-time purchase per course, with lifetime access and a 30-day refund.</p>
        </header>

        {cart.length ? (
          <div className="cart">
            <ul className="cart-list" aria-label="Courses in your cart">
              {cart.map((c) => (
                <li key={c.id} className="cart-row">
                  <CourseMark course={c} size={44} />
                  <div className="cart-main">
                    <button className="cart-title" onClick={() => navigateTo('course-details', { courseId: c.id })}>{c.title}</button>
                    <span className="mono muted">{c.subtitle} · {getLessonCount(c.id)} lessons</span>
                  </div>
                  <span className="cart-price mono">{formatPrice(c.price)}</span>
                  <button className="icon-btn is-quiet" onClick={() => removeFromCart(c.id)} aria-label={`Remove ${c.title} from cart`}>
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
            <aside className="cart-summary" aria-label="Order summary">
              <dl>
                <div><dt>{cart.length} course{cart.length > 1 ? 's' : ''}</dt><dd className="mono">{formatPriceExact(total)}</dd></div>
                <div className="cart-total"><dt>Total</dt><dd className="mono">{formatPriceExact(total)}</dd></div>
              </dl>
              <button className="btn btn-accent btn-block btn-lg" onClick={() => startPurchaseFlow(cart)}>
                Check out <ArrowRight size={16} />
              </button>
              <button className="btn btn-ghost btn-block btn-sm" onClick={clearCart}>Empty cart</button>
            </aside>
          </div>
        ) : (
          <div className="empty">
            <ShoppingBag size={28} aria-hidden="true" />
            <h2>Your cart is empty</h2>
            <p>Add courses from the catalog, or enrol directly from any course page.</p>
            <button className="btn btn-primary" onClick={() => navigateTo('courses')}>Browse courses <ArrowRight size={15} /></button>
          </div>
        )}
      </div>
    </div>
  );
};
