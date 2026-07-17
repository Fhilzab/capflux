import { ref, onMounted, onUnmounted, computed } from 'vue';

export interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  staggerDelay?: number;
}

export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', staggerDelay = 100 } = options;
  
  const prefersReducedMotion = ref(false);
  const observer = ref<IntersectionObserver | null>(null);
  
  const checkMotionPreference = () => {
    if (typeof window !== 'undefined') {
      prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  };
  
  const observeElements = (
    elements: Element[],
    callback: (el: Element, isIntersecting: boolean) => void
  ) => {
    if (prefersReducedMotion.value) {
      // If reduced motion, immediately reveal all elements
      elements.forEach(el => callback(el, true));
      return;
    }
    
    if (!observer.value) {
      observer.value = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            callback(entry.target, entry.isIntersecting);
          });
        },
        { threshold, rootMargin }
      );
    }
    
    elements.forEach(el => observer.value?.observe(el));
  };
  
  const unobserveElements = (elements: Element[]) => {
    elements.forEach(el => observer.value?.unobserve(el));
  };
  
  onMounted(() => {
    checkMotionPreference();
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-reduced-motion: reduce)')
        .addEventListener('change', checkMotionPreference);
    }
  });
  
  onUnmounted(() => {
    if (observer.value) {
      observer.value.disconnect();
    }
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-reduced-motion: reduce)')
        .removeEventListener('change', checkMotionPreference);
    }
  });
  
  return {
    observeElements,
    unobserveElements,
    prefersReducedMotion: computed(() => prefersReducedMotion.value),
  };
}