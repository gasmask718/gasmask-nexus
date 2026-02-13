import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Users, MapPin, Star, ChevronDown, Instagram, Twitter, ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

import heroImg from '@/assets/twl-hero.jpg';
import product1 from '@/assets/twl-product-1.jpg';
import product2 from '@/assets/twl-product-2.jpg';
import product3 from '@/assets/twl-product-3.jpg';
import product4 from '@/assets/twl-product-4.jpg';
import lifestyle1 from '@/assets/twl-lifestyle-1.jpg';
import lifestyle2 from '@/assets/twl-lifestyle-2.jpg';

const NAV_LINKS = ['Home', 'Shop', 'New Drop', 'Find a Store', 'About', 'Contact'];

const PRODUCTS = [
  { name: 'Signature Hoodie', price: '$89', img: product1, tag: 'New Drop' },
  { name: 'Urban Mask Collection', price: '$45', img: product2, tag: 'Limited' },
  { name: 'Premium Snapback', price: '$65', img: product3, tag: 'Bestseller' },
  { name: 'Street Edition Joggers', price: '$120', img: product4, tag: 'New Drop' },
];

const STATS = [
  { value: '50+', label: 'Retail Partners', icon: MapPin },
  { value: '10K+', label: 'Community Members', icon: Users },
  { value: '4.9', label: 'Average Rating', icon: Star },
];

// ─── Animated Section Wrapper ────────────────────────────────────────────────
function RevealSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-black/90 backdrop-blur-xl border-b border-red-500/20 shadow-[0_4px_30px_rgba(255,0,0,0.1)]' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-[0.25em] uppercase text-white">
            Gas<span className="text-red-500">Mask</span>
          </span>
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-red-500 border border-red-500 px-1.5 py-0.5 leading-none">
            Approved
          </span>
        </motion.div>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-xs font-bold tracking-[0.2em] uppercase text-white/70 hover:text-red-500 transition-colors duration-300 relative group"
            >
              {link}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-red-500 transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <Button variant="ghost" size="icon" className="text-white hover:text-red-500 hover:bg-red-500/10">
            <ShoppingBag className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-white">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden bg-black/95 backdrop-blur-xl border-t border-red-500/20 overflow-hidden"
          >
            <div className="flex flex-col px-6 py-4 gap-4">
              {NAV_LINKS.map((link) => (
                <a key={link} href="#" className="text-sm font-bold tracking-widest uppercase text-white/70 hover:text-red-500 transition-colors">
                  {link}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────
function HeroSection() {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 250]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0]);

  return (
    <section className="relative h-screen overflow-hidden">
      {/* Parallax background */}
      <motion.div style={{ y }} className="absolute inset-0">
        <img src={heroImg} alt="GasMask streetwear" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black" />
        <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 via-transparent to-transparent" />
      </motion.div>

      {/* Animated scanline */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.1) 2px, rgba(255,0,0,0.1) 4px)' }}
      />

      {/* Content */}
      <motion.div style={{ opacity }} className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.2em] uppercase text-white mb-2 leading-[0.9]">
            Approved
          </h1>
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-[0.3em] uppercase text-red-500 mb-8">
            Worldwide
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-base sm:text-lg text-white/60 max-w-xl mb-10 font-light"
        >
          Born in smoke. Street luxury culture meets underground fashion.
          <br />This isn't fashion — it's a statement.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <Button className="bg-red-600 hover:bg-red-700 text-white font-bold tracking-[0.2em] uppercase px-10 py-6 text-sm rounded-none shadow-[0_0_30px_rgba(255,0,0,0.3)] hover:shadow-[0_0_50px_rgba(255,0,0,0.5)] transition-all">
            Shop the Drop
          </Button>
          <Button variant="outline" className="border-white/30 text-white hover:border-red-500 hover:text-red-500 hover:bg-red-500/5 font-bold tracking-[0.2em] uppercase px-10 py-6 text-sm rounded-none transition-all">
            Join the Movement
          </Button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10"
        >
          <ChevronDown className="w-6 h-6 text-red-500/60" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── Stats Ticker ────────────────────────────────────────────────────────────
function StatsTicker() {
  return (
    <section className="bg-red-600 py-4 overflow-hidden relative">
      <div className="animate-marquee flex whitespace-nowrap gap-16 px-8">
        {[...Array(3)].map((_, rep) => (
          <div key={rep} className="flex gap-16">
            {STATS.map((stat, i) => (
              <div key={`${rep}-${i}`} className="flex items-center gap-3">
                <stat.icon className="w-5 h-5 text-white/80" />
                <span className="text-white font-black text-lg">{stat.value}</span>
                <span className="text-white/70 text-sm font-medium uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
            <span className="text-white/30 text-sm font-bold uppercase tracking-[0.3em]">★ GasMask Approved ★</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Products Grid ───────────────────────────────────────────────────────────
function ProductsSection() {
  return (
    <section className="bg-black py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <RevealSection>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-[0.15em] uppercase text-white mb-4">
              Featured <span className="text-red-500">Drops</span>
            </h2>
            <p className="text-white/40 text-sm tracking-widest uppercase">Discover our latest collection</p>
          </div>
        </RevealSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PRODUCTS.map((product, i) => (
            <RevealSection key={product.name} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="group cursor-pointer"
              >
                <div className="relative overflow-hidden bg-[hsl(0,0%,5%)] border border-white/5 rounded-sm">
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={product.img}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </div>

                  {/* Tag */}
                  <span className="absolute top-3 left-3 text-[10px] font-bold tracking-[0.2em] uppercase bg-red-600 text-white px-2.5 py-1">
                    {product.tag}
                  </span>

                  {/* Quick action */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileHover={{ opacity: 1, y: 0 }}
                    className="absolute bottom-4 left-4 right-4"
                  >
                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold tracking-widest uppercase text-xs rounded-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                      Add to Cart
                    </Button>
                  </motion.div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <h3 className="text-white font-bold text-sm tracking-wide">{product.name}</h3>
                  <span className="text-red-500 font-black text-lg">{product.price}</span>
                </div>
              </motion.div>
            </RevealSection>
          ))}
        </div>

        <RevealSection delay={0.3} className="text-center mt-12">
          <Button variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500 font-bold tracking-[0.2em] uppercase px-10 py-5 text-xs rounded-none transition-all group">
            View All Products <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </RevealSection>
      </div>
    </section>
  );
}

// ─── Lifestyle Section ───────────────────────────────────────────────────────
function LifestyleSection() {
  return (
    <section className="bg-[hsl(0,0%,3%)] py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <RevealSection>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-[0.15em] uppercase text-white mb-4">
              The <span className="text-red-500">Lifestyle</span>
            </h2>
            <p className="text-white/40 text-sm tracking-widest uppercase">More than just a brand</p>
          </div>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RevealSection delay={0.1}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 200 }} className="relative overflow-hidden rounded-sm aspect-[4/3]">
              <img src={lifestyle1} alt="GasMask lifestyle" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6">
                <span className="text-red-500 text-xs font-bold tracking-[0.3em] uppercase">Street Culture</span>
                <h3 className="text-white text-2xl font-black tracking-wide mt-1">Born in the Underground</h3>
              </div>
            </motion.div>
          </RevealSection>

          <RevealSection delay={0.2}>
            <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 200 }} className="relative overflow-hidden rounded-sm aspect-[4/3]">
              <img src={lifestyle2} alt="GasMask fashion flatlay" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6">
                <span className="text-red-500 text-xs font-bold tracking-[0.3em] uppercase">Premium Quality</span>
                <h3 className="text-white text-2xl font-black tracking-wide mt-1">Every Thread Counts</h3>
              </div>
            </motion.div>
          </RevealSection>
        </div>
      </div>
    </section>
  );
}

// ─── CTA / Newsletter ────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="relative py-32 px-6 overflow-hidden">
      {/* Red glow background */}
      <div className="absolute inset-0 bg-black">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-600/10 blur-[150px]" />
      </div>

      <RevealSection className="relative z-10 max-w-2xl mx-auto text-center">
        <h2 className="text-4xl md:text-5xl font-black tracking-[0.15em] uppercase text-white mb-4">
          Join the <span className="text-red-500">Family</span>
        </h2>
        <p className="text-white/50 mb-10 text-sm tracking-wider">
          Get exclusive drops, early access, and street culture updates. No spam. Just heat.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 bg-white/5 border border-white/10 focus:border-red-500 text-white placeholder:text-white/30 px-5 py-4 text-sm rounded-none outline-none transition-colors"
          />
          <Button className="bg-red-600 hover:bg-red-700 text-white font-bold tracking-[0.2em] uppercase px-8 py-4 text-xs rounded-none shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:shadow-[0_0_40px_rgba(255,0,0,0.5)] transition-all whitespace-nowrap">
            Subscribe
          </Button>
        </div>
      </RevealSection>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-black border-t border-white/5 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div>
            <span className="text-xl font-black tracking-[0.25em] uppercase text-white">
              Gas<span className="text-red-500">Mask</span>
            </span>
            <p className="text-white/30 text-sm mt-4 leading-relaxed">
              Street luxury culture. Born in smoke, approved worldwide.
            </p>
            <div className="flex gap-4 mt-6">
              <a href="#" className="text-white/30 hover:text-red-500 transition-colors"><Instagram className="w-5 h-5" /></a>
              <a href="#" className="text-white/30 hover:text-red-500 transition-colors"><Twitter className="w-5 h-5" /></a>
            </div>
          </div>

          {/* Links */}
          {[
            { title: 'Shop', links: ['New Drops', 'Hoodies', 'Accessories', 'Limited Edition'] },
            { title: 'Company', links: ['About Us', 'Find a Store', 'Become a Vendor', 'Careers'] },
            { title: 'Support', links: ['Contact', 'Shipping', 'Returns', 'FAQ'] },
          ].map(({ title, links }) => (
            <div key={title}>
              <h4 className="text-white font-bold text-xs tracking-[0.3em] uppercase mb-4">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-white/30 hover:text-red-500 text-sm transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/20 text-xs tracking-wider">© 2026 GasMask Approved. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-white/20 hover:text-white/50 text-xs tracking-wider transition-colors">Privacy Policy</a>
            <a href="#" className="text-white/20 hover:text-white/50 text-xs tracking-wider transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Landing Page ───────────────────────────────────────────────────────
export default function TWLLanding() {
  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <StatsTicker />
      <ProductsSection />
      <LifestyleSection />
      <CTASection />
      <Footer />
    </div>
  );
}
