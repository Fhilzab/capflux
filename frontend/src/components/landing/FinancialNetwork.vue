<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useThemeStore } from '../../stores/themeStore';

const themeStore = useThemeStore();
const canvasRef = ref<HTMLCanvasElement | null>(null);

const prefersReducedMotion = ref(false);
let animationFrame: number | null = null;
let particles: Particle[] = [];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const initParticles = (width: number, height: number) => {
  particles = [];
  const particleCount = 30;
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 2 + 1.5,
    });
  }
};

const animate = () => {
  if (!canvasRef.value || prefersReducedMotion.value) return;
  
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  
  ctx.clearRect(0, 0, width, height);

  const isDark = themeStore.mode === 'dark';
  
  // Dark mode: brighter emerald with subtle glow for visibility on dark background
  // Light mode: emerald with moderate opacity
  const particleColor = isDark 
    ? 'rgba(16, 185, 128, 0.9)' 
    : 'rgba(5, 150, 105, 0.7)';
  const lineColor = isDark 
    ? 'rgba(16, 185, 128, 0.5)' 
    : 'rgba(5, 150, 105, 0.35)';

  // Update and draw particles
  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;

    // Boundary bounce
    if (particle.x < 0 || particle.x > width) particle.vx *= -1;
    if (particle.y < 0 || particle.y > height) particle.vy *= -1;

    // Add glow effect for dark mode
    if (isDark) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(16, 185, 128, 0.5)';
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = particleColor;
    ctx.fill();
    
    ctx.shadowBlur = 0; // Reset shadow
  });

  // Draw connections
  const maxDistance = 150;
  particles.forEach((p1, i) => {
    particles.slice(i + 1).forEach((p2) => {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < maxDistance) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  });

  animationFrame = requestAnimationFrame(animate);
};

const handleResize = () => {
  if (canvasRef.value) {
    const parent = canvasRef.value.parentElement;
    canvasRef.value.width = parent?.clientWidth || window.innerWidth;
    canvasRef.value.height = parent?.clientHeight || window.innerHeight;
    initParticles(canvasRef.value.width, canvasRef.value.height);
  }
};

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  handleResize();
  if (!prefersReducedMotion.value) {
    animate();
  }
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  window.removeEventListener('resize', handleResize);
});

watch(
  () => themeStore.mode,
  () => {
    // Theme change triggers re-render through animation loop
  }
);
</script>

<template>
  <canvas
    ref="canvasRef"
    class="absolute inset-0 w-full h-full"
    aria-hidden="true"
  />
</template>

<style scoped>
canvas {
  pointer-events: none;
}
</style>