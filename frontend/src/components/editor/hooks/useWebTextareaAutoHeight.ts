import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface UseWebTextareaAutoHeightProps {
  content?: string;
  externalInputRef?: (el: any) => void;
}

export const useWebTextareaAutoHeight = ({
  content,
  externalInputRef,
}: UseWebTextareaAutoHeightProps = {}) => {
  const localInputRef = useRef<any>(null);

  const adjustWebTextareaHeight = (el: any) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const domEl = el && el.tagName === 'TEXTAREA' ? el : el?.querySelector?.('textarea') || el;
    if (!domEl || !domEl.style) return;

    const apply = () => {
      try {
        (domEl.style as any).fieldSizing = 'content';
        domEl.style.overflow = 'hidden';
        domEl.style.resize = 'none';
        if ('rows' in domEl) {
          domEl.rows = 1;
        }

        domEl.style.height = 'auto';
        const scrollH = domEl.scrollHeight;
        if (scrollH > 0) {
          domEl.style.height = `${scrollH}px`;
        }
      } catch (err) {
        // ignore
      }
    };

    apply();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(apply);
    }
  };

  const setInputRef = (el: any) => {
    localInputRef.current = el;
    externalInputRef?.(el);
    if (el) {
      adjustWebTextareaHeight(el);
    }
  };

  useEffect(() => {
    adjustWebTextareaHeight(localInputRef.current);
  }, [content]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleResize = () => {
      adjustWebTextareaHeight(localInputRef.current);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    localInputRef,
    setInputRef,
    adjustWebTextareaHeight,
  };
};

