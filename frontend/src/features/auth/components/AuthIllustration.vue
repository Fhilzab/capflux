<template>
  <div class="flex h-full w-full flex-col justify-center p-8 lg:p-16">
    <!-- Logo -->
    <div class="mb-12">
      <svg class="h-10 w-auto" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="24" font-family="var(--font-family-sans)" font-weight="700" font-size="24" class="fill-text-primary">
          Capstone
        </text>
      </svg>
    </div>

    <!-- Headline -->
    <h1 class="text-display mb-6 text-text-primary">
      Every Naira Accounted For.
    </h1>

    <!-- Supporting Text -->
    <p class="text-xl text-text-secondary mb-12 max-w-md">
      Financial Operating System for African Private Schools.
    </p>

    <!-- Financial Network Animation -->
    <div class="relative">
      <svg class="w-full max-w-lg" viewBox="0 0 500 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Background nodes (faint) -->
        <circle cx="250" cy="150" r="3" class="fill-primary/5" />
        <circle cx="100" cy="80" r="2" class="fill-primary/10" />
        <circle cx="400" cy="80" r="2" class="fill-primary/10" />
        <circle cx="100" cy="220" r="2" class="fill-primary/10" />
        <circle cx="400" cy="220" r="2" class="fill-primary/10" />
        <circle cx="250" cy="20" r="2" class="fill-primary/8" />
        <circle cx="250" cy="280" r="2" class="fill-primary/8" />
        <circle cx="50" cy="150" r="2" class="fill-primary/8" />
        <circle cx="450" cy="150" r="2" class="fill-primary/8" />

        <!-- Connection lines -->
        <path d="M250 150 L100 80 M250 150 L400 80 M250 150 L100 220 M250 150 L400 220 M250 150 L250 20 M250 150 L250 280 M250 150 L50 150 M250 150 L450 150 M100 80 L400 80 M100 220 L400 220"
              stroke="currentColor" stroke-width="1" class="stroke-primary/10" />

        <!-- Central node (pulsing) -->
        <circle cx="250" cy="150" r="4" class="fill-primary animate-pulse" />

        <!-- Animated pulse rings -->
        <circle cx="250" cy="150" r="8" class="fill-primary/0 animate-ping delay-500" />
        <circle cx="250" cy="150" r="12" class="fill-primary/0 animate-ping delay-1000" />
      </svg>
    </div>

    <!-- Trust Indicators -->
    <div class="mt-12 text-sm text-text-muted">
      <p>Trusted by 500+ schools across Nigeria</p>
    </div>
  </div>
</template>