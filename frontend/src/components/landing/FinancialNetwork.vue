<script setup lang="ts">
defineProps<{
  isActive?: boolean;
}>();
</script>

<template>
  <div class="absolute inset-0 overflow-hidden" aria-hidden="true">
    <!-- Animated gradient background -->
    <div class="absolute inset-0 bg-gradient-to-br from-brand/[0.02] via-transparent to-success/[0.02] animate-gradient-shift"></div>
    
    <!-- Floating payment cards -->
    <div class="absolute inset-0 pointer-events-none">
      <div
        v-for="(card, index) in 6"
        :key="index"
        class="absolute rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 p-4 shadow-card transform transition-all duration-1000"
        :class="`floating-card-${index}`"
        :style="`--delay: ${index * 0.5}s; --float-distance: ${20 + index * 10}px;`"
      >
        <div class="flex items-center gap-3 mb-2">
          <div class="h-3 w-3 rounded-full" :class="index % 3 === 0 ? 'bg-brand' : index % 3 === 1 ? 'bg-success' : 'bg-info'"></div>
          <span class="text-xs font-mono text-text-muted">DVA-{{ Math.floor(Math.random() * 900) + 100 }}</span>
        </div>
        <div class="text-sm font-semibold text-text-primary mb-1">₦ {{ (Math.random() * 50000).toFixed(0) }}</div>
        <div class="text-xs text-text-muted">Student {{ Math.floor(Math.random() * 100) + 1 }}</div>
      </div>
    </div>

    <!-- Central financial node -->
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="relative">
        <!-- Pulse rings -->
        <div class="absolute h-32 w-32 rounded-full border border-brand/20 animate-ping-slow"></div>
        <div class="absolute h-48 w-48 rounded-full border border-brand/10 animate-ping-slower"></div>
        
        <!-- Central node -->
        <div class="h-16 w-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
          <svg class="h-8 w-8 text-brand" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2 1.343-2zm0 0v.5" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 12v3.5" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v3" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 8a7 7 0 0114 0c0 2.21-.9 4.2-2.25 5.64A6.97 6.97 0 0112 15a6.97 6.97 0 01-4.75-1.36C5.9 12.2 5 10.21 5 8z" />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Floating card animations */
@keyframes float-card-0 {
  0%, 100% { transform: translate(-100px, -50px) rotate(-5deg); }
  25% { transform: translate(-80px, -30px) rotate(2deg); }
  50% { transform: translate(-120px, -70px) rotate(-3deg); }
  75% { transform: translate(-90px, -40px) rotate(5deg); }
}

@keyframes float-card-1 {
  0%, 100% { transform: translate(200px, -80px) rotate(8deg); }
  33% { transform: translate(220px, -60px) rotate(5deg); }
  66% { transform: translate(180px, -100px) rotate(12deg); }
}

@keyframes float-card-2 {
  0%, 100% { transform: translate(-150px, 100px) rotate(-12deg); }
  25% { transform: translate(-130px, 80px) rotate(-8deg); }
  50% { transform: translate(-170px, 120px) rotate(-15deg); }
  75% { transform: translate(-140px, 90px) rotate(-10deg); }
}

@keyframes float-card-3 {
  0%, 100% { transform: translate(150px, 120px) rotate(10deg); }
  50% { transform: translate(170px, 100px) rotate(15deg); }
}

@keyframes float-card-4 {
  0%, 100% { transform: translate(-200px, -20px) rotate(-8deg); }
  33% { transform: translate(-180px, -40px) rotate(-12deg); }
  66% { transform: translate(-220px, -10px) rotate(-5deg); }
}

@keyframes float-card-5 {
  0%, 100% { transform: translate(120px, -150px) rotate(15deg); }
  50% { transform: translate(100px, -130px) rotate(18deg); }
}

.floating-card-0 {
  top: 20%;
  left: 10%;
  animation: float-card-0 20s ease-in-out infinite;
  animation-delay: var(--delay);
}

.floating-card-1 {
  top: 30%;
  right: 15%;
  animation: float-card-1 25s ease-in-out infinite;
  animation-delay: var(--delay);
}

.floating-card-2 {
  bottom: 25%;
  left: 20%;
  animation: float-card-2 22s ease-in-out infinite;
  animation-delay: var(--delay);
}

.floating-card-3 {
  bottom: 30%;
  right: 25%;
  animation: float-card-3 28s ease-in-out infinite;
  animation-delay: var(--delay);
}

.floating-card-4 {
  top: 60%;
  left: 5%;
  animation: float-card-4 24s ease-in-out infinite;
  animation-delay: var(--delay);
}

.floating-card-5 {
  top: 15%;
  right: 30%;
  animation: float-card-5 26s ease-in-out infinite;
  animation-delay: var(--delay);
}

/* Gradient animation */
@keyframes gradient-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.animate-gradient-shift {
  background-size: 200% 200%;
  animation: gradient-shift 30s ease infinite;
}

/* Ping animations for central node */
@keyframes ping-slow {
  0% { opacity: 0; transform: scale(0.8); }
  50% { opacity: 0.3; }
  100% { opacity: 0; transform: scale(1.2); }
}

@keyframes ping-slower {
  0% { opacity: 0; transform: scale(0.8); }
  50% { opacity: 0.2; }
  100% { opacity: 0; transform: scale(1.4); }
}

.animate-ping-slow {
  animation: ping-slow 4s ease-in-out infinite;
}

.animate-ping-slower {
  animation: ping-slower 6s ease-in-out infinite;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .floating-card-0,
  .floating-card-1,
  .floating-card-2,
  .floating-card-3,
  .floating-card-4,
  .floating-card-5,
  .animate-gradient-shift,
  .animate-ping-slow,
  .animate-ping-slower {
    animation: none;
  }
}
</style>