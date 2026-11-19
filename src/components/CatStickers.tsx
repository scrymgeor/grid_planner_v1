import React, { useState } from 'react';
import { motion } from 'motion/react';

interface StickerProps {
  className?: string;
  perked?: boolean;
}

/**
 * Tuxedo cat peeking over the top edge of cards or buttons.
 */
export const PeekingCatSticker: React.FC<StickerProps> = ({ className = '', perked = false }) => {
  const [bounced, setBounced] = useState(false);

  const triggerBounce = () => {
    setBounced(true);
    setTimeout(() => setBounced(false), 650);
  };

  return (
    <motion.button
      type="button"
      onClick={triggerBounce}
      aria-label="Interactive peeking cat sticker"
      animate={{
        y: perked || bounced ? -6 : [0, -2, 0],
        rotate: bounced ? [-3, 3, 0] : perked ? -2 : 0,
      }}
      transition={
        perked || bounced
          ? { type: 'spring', stiffness: 420, damping: 18 }
          : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
      }
      whileHover={{ scale: 1.08, y: -5 }}
      whileTap={{ scale: 0.94 }}
      className={`relative cursor-pointer select-none focus:outline-none ${className}`}
    >
      <svg
        viewBox="0 0 120 76"
        className="h-full w-full drop-shadow-[2px_3px_0px_#141923]"
        aria-hidden="true"
      >
        {/* Die-cut white vinyl sticker outline */}
        <path
          d="M22 66 L26 24 L42 36 Q60 30 78 36 L94 24 L98 66 Q108 66 108 72 L12 72 Q12 66 22 66 Z"
          fill="#FFFFFF"
          stroke="#FFFFFF"
          strokeWidth="10"
          strokeLinejoin="round"
        />
        {/* Ears */}
        <motion.path
          animate={{ rotate: perked || bounced ? [-4, 4, 0] : [0, -2, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '34px', originY: '36px' }}
          d="M26 52 L28 22 L46 36 Z"
          fill="#1B2230"
          stroke="#141923"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <motion.path
          animate={{ rotate: perked || bounced ? [4, -4, 0] : [0, 2, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '86px', originY: '36px' }}
          d="M94 52 L92 22 L74 36 Z"
          fill="#1B2230"
          stroke="#141923"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* Inner ears */}
        <path d="M31 44 L31 28 L42 37 Z" fill="#FF9BAE" />
        <path d="M89 44 L89 28 L78 37 Z" fill="#FF9BAE" />
        {/* Head */}
        <path
          d="M24 68 C24 44, 38 33, 60 33 C82 33, 96 44, 96 68 Z"
          fill="#1B2230"
          stroke="#141923"
          strokeWidth="3"
        />
        {/* White muzzle */}
        <ellipse cx="60" cy="60" rx="16" ry="11" fill="#FFFFFF" />
        {/* Eyes with periodic blink */}
        <motion.g
          animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 4.5, times: [0, 0.45, 0.48, 0.52, 1], repeat: Infinity }}
          style={{ originY: '51px' }}
        >
          <circle cx="45" cy="51" r="4.8" fill="#4CE87A" />
          <circle cx="46.2" cy="50" r="2" fill="#141923" />
          <circle cx="44" cy="49" r="1.2" fill="#FFFFFF" />
          <circle cx="75" cy="51" r="4.8" fill="#4CE87A" />
          <circle cx="73.8" cy="50" r="2" fill="#141923" />
          <circle cx="76" cy="49" r="1.2" fill="#FFFFFF" />
        </motion.g>
        {/* Nose & :3 smile */}
        <polygon points="57,56 63,56 60,59.5" fill="#FF7B95" />
        <path
          d="M54 61 Q57 64 60 60 Q63 64 66 61"
          fill="none"
          stroke="#141923"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Whiskers */}
        <path
          d="M32 56 L19 54 M32 61 L19 62 M88 56 L101 54 M88 61 L101 62"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* Little paws resting on edge */}
        <ellipse cx="34" cy="68" rx="9" ry="6" fill="#FFFFFF" stroke="#141923" strokeWidth="2.5" />
        <ellipse cx="86" cy="68" rx="9" ry="6" fill="#FFFFFF" stroke="#141923" strokeWidth="2.5" />
      </svg>
    </motion.button>
  );
};

/**
 * Cozy ginger-tabby sticker holding a warm mug of focus tea/coffee.
 */
export const CoffeeCatSticker: React.FC<StickerProps> = ({ className = '' }) => {
  const [bounced, setBounced] = useState(false);

  const triggerBounce = () => {
    setBounced(true);
    setTimeout(() => setBounced(false), 650);
  };

  return (
    <motion.button
      type="button"
      onClick={triggerBounce}
      aria-label="Interactive coffee cat sticker"
      animate={{
        y: bounced ? [-8, 0] : [0, -4, 0],
        rotate: bounced ? [0, 8, -4, 0] : [-4, -1, -4],
      }}
      transition={
        bounced
          ? { duration: 0.45, ease: 'easeOut' }
          : { duration: 4.2, repeat: Infinity, ease: 'easeInOut' }
      }
      whileHover={{ scale: 1.12, rotate: 4 }}
      whileTap={{ scale: 0.9 }}
      className={`relative cursor-pointer select-none focus:outline-none ${className}`}
    >
      <svg
        viewBox="0 0 110 110"
        className="h-full w-full drop-shadow-[3px_3px_0px_#141923]"
        aria-hidden="true"
      >
        {/* White die-cut sticker halo */}
        <circle cx="55" cy="58" r="40" fill="#FFFFFF" />
        <path d="M24 44 L26 16 L46 30 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="10" strokeLinejoin="round" />
        <path d="M86 44 L84 16 L64 30 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="10" strokeLinejoin="round" />

        {/* Steam wisps */}
        <motion.path
          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          d="M48 80 Q44 74 49 69 M59 79 Q63 73 58 68"
          fill="none"
          stroke="#7CB8E8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Ears */}
        <path d="M26 46 L27 18 L46 32 Z" fill="#FF9D4D" stroke="#141923" strokeWidth="3" strokeLinejoin="round" />
        <path d="M84 46 L83 18 L64 32 Z" fill="#FF9D4D" stroke="#141923" strokeWidth="3" strokeLinejoin="round" />
        <path d="M31 40 L31 25 L41 33 Z" fill="#FFD1DC" />
        <path d="M79 40 L79 25 L69 33 Z" fill="#FFD1DC" />

        {/* Body & Head */}
        <ellipse cx="55" cy="64" rx="31" ry="28" fill="#FFB26B" stroke="#141923" strokeWidth="3" />
        {/* Forehead stripes */}
        <path d="M55 37 V44 M49 38 L51 44 M61 38 L59 44" stroke="#D96B27" strokeWidth="2.8" strokeLinecap="round" />
        {/* Happy closed eyes */}
        <path d="M38 55 Q43 50 48 55" fill="none" stroke="#141923" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M62 55 Q67 50 72 55" fill="none" stroke="#141923" strokeWidth="2.8" strokeLinecap="round" />
        {/* Rosy cheeks */}
        <ellipse cx="36" cy="60" rx="4" ry="2.5" fill="#FF7B95" opacity="0.7" />
        <ellipse cx="74" cy="60" rx="4" ry="2.5" fill="#FF7B95" opacity="0.7" />
        {/* Smile */}
        <path d="M51 60 Q55 64 59 60" fill="none" stroke="#141923" strokeWidth="2.4" strokeLinecap="round" />
        {/* Red arcade mug */}
        <rect x="42" y="72" width="26" height="20" rx="5" fill="#E3242B" stroke="#141923" strokeWidth="2.8" />
        <path d="M68 77 Q75 77 75 82 Q75 87 68 87" fill="none" stroke="#141923" strokeWidth="2.8" />
        <circle cx="55" cy="82" r="4" fill="#FFF9E6" />
        {/* Paws holding mug */}
        <circle cx="41" cy="79" r="5" fill="#FFF2E0" stroke="#141923" strokeWidth="2.4" />
        <circle cx="69" cy="79" r="5" fill="#FFF2E0" stroke="#141923" strokeWidth="2.4" />
      </svg>
    </motion.button>
  );
};

/**
 * Cheerful cream & dark-spot lucky cat sticker with wagging tail & floating star.
 */
export const StarCatSticker: React.FC<StickerProps> = ({ className = '' }) => {
  const [spun, setSpun] = useState(false);

  const triggerSpin = () => {
    setSpun(true);
    setTimeout(() => setSpun(false), 650);
  };

  return (
    <motion.button
      type="button"
      onClick={triggerSpin}
      aria-label="Interactive star cat sticker"
      animate={{
        y: spun ? [-8, 0] : [0, 4, 0],
        rotate: spun ? [5, -10, 5] : [5, 2, 5],
      }}
      transition={
        spun
          ? { duration: 0.45, ease: 'easeOut' }
          : { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }
      }
      whileHover={{ scale: 1.12, rotate: -4 }}
      whileTap={{ scale: 0.9 }}
      className={`relative cursor-pointer select-none focus:outline-none ${className}`}
    >
      <svg
        viewBox="0 0 116 110"
        className="h-full w-full drop-shadow-[3px_3px_0px_#141923]"
        aria-hidden="true"
      >
        {/* White die-cut sticker contour */}
        <circle cx="56" cy="58" r="38" fill="#FFFFFF" />
        <path d="M26 46 L26 16 L46 30 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="10" strokeLinejoin="round" />
        <path d="M84 46 L86 16 L64 30 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="10" strokeLinejoin="round" />

        {/* Wagging tail */}
        <motion.path
          animate={{ rotate: [-8, 12, -8] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '84px', originY: '78px' }}
          d="M84 78 Q103 70 98 52"
          fill="none"
          stroke="#141923"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <motion.path
          animate={{ rotate: [-8, 12, -8] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '84px', originY: '78px' }}
          d="M84 78 Q103 70 98 52"
          fill="none"
          stroke="#FFF7E2"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Ears */}
        <path d="M27 45 L27 18 L46 32 Z" fill="#FFF7E2" stroke="#141923" strokeWidth="3" strokeLinejoin="round" />
        <path d="M85 45 L85 18 L66 32 Z" fill="#3B4559" stroke="#141923" strokeWidth="3" strokeLinejoin="round" />
        {/* Head & Chubby Body */}
        <ellipse cx="56" cy="61" rx="30" ry="27" fill="#FFF7E2" stroke="#141923" strokeWidth="3" />
        {/* Dark patch on right ear/eye */}
        <path d="M58 35 C74 35 84 46 82 58 C74 58 64 51 58 35 Z" fill="#3B4559" />
        {/* Green collar + gold bell */}
        <path d="M32 76 Q56 84 80 76" fill="none" stroke="#36D96B" strokeWidth="5" strokeLinecap="round" />
        <circle cx="56" cy="81" r="4.5" fill="#FFD447" stroke="#141923" strokeWidth="2" />
        {/* Bright sparkling eyes */}
        <circle cx="43" cy="55" r="4.5" fill="#141923" />
        <circle cx="41.5" cy="53.5" r="1.5" fill="#FFFFFF" />
        <circle cx="69" cy="55" r="4.5" fill="#FFFFFF" />
        <circle cx="69" cy="55" r="2.6" fill="#141923" />
        {/* Pink nose & smile */}
        <polygon points="53,59 59,59 56,62" fill="#FF7B95" />
        <path d="M51 64 Q56 67 61 64" fill="none" stroke="#141923" strokeWidth="2.2" strokeLinecap="round" />
        {/* Floating arcade star */}
        <motion.polygon
          animate={{ scale: [0.9, 1.15, 0.9], rotate: [0, 15, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '18px', originY: '32px' }}
          points="18,22 20.5,28.5 27,29 22,33.5 23.5,40 18,36.5 12.5,40 14,33.5 9,29 15.5,28.5"
          fill="#FFD447"
          stroke="#141923"
          strokeWidth="2"
        />
      </svg>
    </motion.button>
  );
};

/**
 * Sleepy loaf cat sticker resting comfortably.
 */
export const LoafCatSticker: React.FC<StickerProps> = ({ className = '' }) => {
  const [awake, setAwake] = useState(false);

  const handleWake = () => {
    setAwake(true);
    setTimeout(() => setAwake(false), 1100);
  };

  return (
    <motion.button
      type="button"
      onClick={handleWake}
      aria-label="Interactive loaf cat sticker"
      animate={{ scale: awake ? [1, 1.08, 1] : [1, 1.03, 1] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
      whileHover={{ scale: 1.1, y: -3 }}
      whileTap={{ scale: 0.92 }}
      className={`relative cursor-pointer select-none focus:outline-none ${className}`}
    >
      <svg
        viewBox="0 0 124 88"
        className="h-full w-full drop-shadow-[3px_3px_0px_#141923]"
        aria-hidden="true"
      >
        {/* White sticker border */}
        <ellipse cx="62" cy="54" rx="44" ry="26" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="10" />
        {/* Loaf Body */}
        <path
          d="M22 64 C22 40, 38 30, 62 30 C86 30, 102 42, 102 64 C102 72, 92 76, 62 76 C32 76, 22 72, 22 64 Z"
          fill="#D6E6FF"
          stroke="#141923"
          strokeWidth="3"
        />
        {/* Ears */}
        <path d="M27 42 L26 20 L42 32 Z" fill="#D6E6FF" stroke="#141923" strokeWidth="3" strokeLinejoin="round" />
        <path d="M56 32 L68 18 L72 34 Z" fill="#D6E6FF" stroke="#141923" strokeWidth="3" strokeLinejoin="round" />
        {/* Back stripes */}
        <path d="M74 34 Q78 42 74 48 M84 37 Q88 45 84 51" stroke="#6E94CC" strokeWidth="3" strokeLinecap="round" />
        {/* Eyes (sleepy or wide awake on tap!) */}
        {awake ? (
          <>
            <circle cx="38" cy="50" r="3.8" fill="#141923" />
            <circle cx="36.8" cy="48.8" r="1.2" fill="#FFFFFF" />
            <circle cx="57" cy="50" r="3.8" fill="#141923" />
            <circle cx="55.8" cy="48.8" r="1.2" fill="#FFFFFF" />
          </>
        ) : (
          <>
            <path d="M33 50 Q38 54 43 50" fill="none" stroke="#141923" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M52 50 Q57 54 62 50" fill="none" stroke="#141923" strokeWidth="2.6" strokeLinecap="round" />
          </>
        )}
        {/* Tiny nose & blush */}
        <polygon points="45,54 50,54 47.5,57" fill="#FF7B95" />
        <ellipse cx="32" cy="55" rx="3.5" ry="2" fill="#FF9BAE" opacity="0.7" />
        <ellipse cx="63" cy="55" rx="3.5" ry="2" fill="#FF9BAE" opacity="0.7" />
      </svg>
    </motion.button>
  );
};
