import { ref, computed, watch } from 'vue';

export interface UseCountUpOptions {
  duration?: number;
  easing?: 'linear' | 'easeOut';
  decimals?: number;
}

export function useCountUp(
  endValue: number,
  options: UseCountUpOptions = {}
) {
  const { duration = 1500, easing = 'easeOut', decimals = 0 } = options;
  
  const currentValue = ref(0);
  const isAnimating = ref(false);
  
  const easeOutQuad = (t: number) => t * (2 - t);
  const linear = (t: number) => t;
  
  const formatValue = (value: number) => {
    return decimals > 0 
      ? value.toFixed(decimals) 
      : Math.round(value).toLocaleString();
  };
  
  const displayValue = computed(() => formatValue(currentValue.value));
  
  const startAnimation = () => {
    if (isAnimating.value) return;
    
    isAnimating.value = true;
    const startTime = performance.now();
    const startValue = 0;
    const change = endValue - startValue;
    const easingFn = easing === 'easeOut' ? easeOutQuad : linear;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easingFn(progress);
      
      currentValue.value = startValue + change * easedProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        currentValue.value = endValue;
        isAnimating.value = false;
      }
    };
    
    requestAnimationFrame(animate);
  };
  
  return {
    displayValue,
    startAnimation,
    isAnimating: computed(() => isAnimating.value),
  };
}