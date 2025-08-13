import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useTheme } from 'next-themes';

interface HeroSectionProps {
  navbarHeight: number;
}

const HeroSection: React.FC<HeroSectionProps> = ({ navbarHeight }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });

  const headingText = "AI-Powered Testing and LLM Deployment Assistant";
  const words = headingText.split(' ');

  const generatePath = (i: number, position: number) => {
    const x1 = 380 - i * 5 * position;
    const y1 = -(189 + i * 6);
    const x2 = 312 - i * 5 * position;
    const y2 = 216 - i * 6;
    const x3 = 152 - i * 5 * position;
    const y3 = 343 - i * 6;
    const x4 = 616 - i * 5 * position;
    const y4 = 470 - i * 6;
    const x5 = 684 - i * 5 * position;
    const y5 = 875 - i * 6;

    return `M-${x1} ${y1}C-${x1} ${y1} -${x2} ${y2} ${x3} ${y3}C${x4} ${y4} ${x5} ${y5} ${x5} ${y5}`;
  };

  const paths = Array.from({ length: 36 }).flatMap((_, i) => [
    { d: generatePath(i, 1), key: `path-${i}-1` },
    { d: generatePath(i, -1), key: `path-${i}-minus1` },
  ]);

  const pathVariants = {
    hidden: { pathLength: 0.3, opacity: 0.3, pathOffset: 0 },
    visible: (i: number) => ({
      pathLength: [0.3, 1, 0.3],
      opacity: [0.3, 0.6, 0.3],
      pathOffset: [0, 1, 0],
      transition: {
        duration: 20 + Math.random() * 10,
        ease: 'linear',
        repeat: Infinity,
        delay: i * 0.05, // Stagger paths slightly
      },
    }),
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 100 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 150,
        damping: 25,
      },
    },
  };

  const letterVariants = {
    hidden: { opacity: 0, y: 100 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 150,
        damping: 25,
      },
    },
  };

  return (
    <section
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center overflow-hidden
        ${isDarkMode ? 'bg-neutral-950' : 'bg-white'}`}
      style={{ minHeight: `calc(100vh - ${navbarHeight}px)` }}
    >
      {/* Animated Background Paths */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 696 316"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {paths.map((path, i) => (
          <motion.path
            key={path.key}
            d={path.d}
            stroke={isDarkMode ? 'white' : 'currentColor'}
            strokeWidth={0.5 + (i / paths.length) * 1} // Progressive stroke width
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={pathVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            custom={i}
          />
        ))}
      </svg>

      {/* Content */}
      <div className="relative z-10 text-center px-4 md:px-6 max-w-4xl mx-auto">
        {/* Typography */}
        <motion.h1
          className={`text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold leading-tight tracking-tight
            ${isDarkMode
              ? 'bg-gradient-to-br from-white to-white/80'
              : 'bg-gradient-to-br from-neutral-900 to-neutral-700/80'}
            bg-clip-text text-transparent mb-8`}
        >
          {words.map((word, wordIndex) => (
            <motion.span
              key={wordIndex}
              className="inline-block mr-2"
              variants={wordVariants}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              transition={{ delay: wordIndex * 0.1 }}
            >
              {word.split('').map((char, charIndex) => (
                <motion.span
                  key={charIndex}
                  className="inline-block"
                  variants={letterVariants}
                  initial="hidden"
                  animate={isInView ? "visible" : "hidden"}
                  transition={{ delay: wordIndex * 0.1 + charIndex * 0.03 }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.span>
          ))}
        </motion.h1>

        {/* Call-to-Action Button */}
        <motion.button
          className={`relative inline-flex items-center justify-center rounded-2xl px-8 py-6 text-lg font-semibold
            group transition-all duration-300 ease-out
            ${isDarkMode
              ? 'bg-black/95 hover:bg-black text-white border border-white/10 shadow-lg shadow-white/5'
              : 'bg-white/95 hover:bg-white text-neutral-900 border border-black/10 shadow-lg shadow-black/5'}
            hover:-translate-y-0.5
            before:absolute before:inset-0 before:rounded-2xl before:p-[1px]
            ${isDarkMode
              ? 'before:bg-gradient-to-br before:from-white/10 before:to-black/10'
              : 'before:bg-gradient-to-br before:from-black/10 before:to-white/10'}
            before:z-[-1] before:opacity-0 group-hover:before:opacity-100
            backdrop-blur-sm
          `}
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: words.length * 0.1 + 0.5, duration: 0.5 }}
          onClick={() => window.location.href = '/dashboard'}
        >
          <span className="relative z-10 group-hover:opacity-100 transition-opacity duration-300">
            Start Testing
          </span>
          <ArrowRight
            className="ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
            style={{ transitionDelay: '50ms' }}
          />
        </motion.button>
      </div>
    </section>
  );
};

export default HeroSection;