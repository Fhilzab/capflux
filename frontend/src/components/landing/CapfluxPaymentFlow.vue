<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

/**
 * CapfluxPaymentFlow — Payment infrastructure visualization.
 * Matches the approved visual concept exactly.
 *
 * Animation cycle (6s total):
 * 0.0s  Complete static system visible
 * 0.8s  Payment particle appears at School Payment
 * 1.0s  Particle travels along payment route
 * 2.0s  Particle reaches CAPFLUX
 * 2.0s  CAPFLUX core pulses
 * 2.2s  Payment Verified activates
 * 2.4s  Student account highlights
 * 2.6s  Transaction highlights
 * 3.0s  System remains visible
 * 4.0s  Pause, then repeat
 */

const isReducedMotion = ref(false);
let mediaQuery: MediaQueryList | null = null;

onMounted(() => {
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  isReducedMotion.value = mediaQuery.matches;
  mediaQuery.addEventListener('change', handleMotionChange);
});

onUnmounted(() => {
  mediaQuery?.removeEventListener('change', handleMotionChange);
});

const handleMotionChange = (e: MediaQueryListEvent) => {
  isReducedMotion.value = e.matches;
};
</script>

<template>
  <div class="capflux-payment-flow" :class="{ 'reduced-motion': isReducedMotion }" aria-hidden="true">
    <svg
      viewBox="0 0 720 480"
      class="payment-flow-svg"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <defs>
        <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.08)" />
        </filter>

        <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="0.3" />
          <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.6" />
        </linearGradient>

        <radialGradient id="particle-gradient">
          <stop offset="0%" stop-color="var(--color-brand)" stop-opacity="1" />
          <stop offset="100%" stop-color="var(--color-brand)" stop-opacity="0.3" />
        </radialGradient>

        <linearGradient id="card-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-card)" />
          <stop offset="100%" stop-color="var(--color-sidebar)" />
        </linearGradient>
      </defs>

      <!-- ====== SCHOOL PAYMENT ====== -->
      <g class="school-payment" filter="url(#card-shadow)">
        <rect x="0" y="50" width="180" height="140" rx="14" fill="url(#card-bg)" stroke="var(--color-border)" stroke-width="1.5" />
        <rect x="0" y="50" width="180" height="36" rx="14" fill="var(--color-brand-soft)" />
        <rect x="0" y="72" width="180" height="14" fill="var(--color-brand-soft)" />

        <!-- School building illustration -->
        <g transform="translate(55, 92)">
          <rect x="15" y="28" width="40" height="30" rx="3" fill="var(--color-brand)" opacity="0.15" stroke="var(--color-brand)" stroke-width="1.2" />
          <path d="M35 4 L60 28 L10 28 Z" fill="var(--color-brand)" opacity="0.5" />
          <rect x="28" y="40" width="14" height="18" rx="2" fill="var(--color-brand)" opacity="0.3" />
          <rect x="18" y="34" width="8" height="8" rx="1" fill="var(--color-brand)" opacity="0.25" />
          <rect x="44" y="34" width="8" height="8" rx="1" fill="var(--color-brand)" opacity="0.25" />
        </g>

        <text x="90" y="152" text-anchor="middle" class="label-school">School Payment</text>
        <text x="90" y="172" text-anchor="middle" class="text-amount">₦120,000</text>
      </g>

      <text x="90" y="210" text-anchor="middle" class="text-muted">Parents pay school fees</text>
      <text x="90" y="226" text-anchor="middle" class="text-muted-small">Via bank transfer, card or USSD</text>

      <!-- ====== PAYMENT ROUTE ====== -->
      <g class="payment-route">
        <path
          d="M 180 120 C 220 120, 240 120, 270 120"
          stroke="url(#path-gradient)"
          stroke-width="2"
          stroke-dasharray="6 4"
          class="connection-path"
        />
        <circle cx="180" cy="120" r="4" fill="var(--color-brand)" opacity="0.5" />
        <circle cx="270" cy="120" r="4" fill="var(--color-brand)" opacity="0.5" />

        <!-- Animated payment particle -->
        <circle r="6" fill="url(#particle-gradient)" class="payment-particle" filter="url(#core-glow)">
          <animateMotion
            dur="1.2s"
            repeatCount="indefinite"
            begin="0.8s"
            calcMode="spline"
            keySplines="0.22 1 0.36 1"
            keyPoints="0;0;1;1;0;0"
            keyTimes="0;0.05;0.5;0.55;0.95;1"
            path="M 180 120 C 220 120, 240 120, 270 120"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;1;0;0"
            keyTimes="0;0.08;0.45;0.55;0.85;1"
            dur="1.2s"
            repeatCount="indefinite"
            begin="0.8s"
          />
        </circle>
      </g>

      <!-- ====== CAPFLUX CORE ====== -->
      <g class="capflux-core">
        <!-- Outer pulse rings -->
        <circle cx="330" cy="120" r="72" fill="none" stroke="var(--color-brand)" stroke-width="1.5" opacity="0.12" class="core-ring-outer" />
        <circle cx="330" cy="120" r="62" fill="none" stroke="var(--color-brand)" stroke-width="1" opacity="0.08" class="core-ring-inner" />

        <!-- Core background -->
        <circle cx="330" cy="120" r="52" fill="var(--color-card)" stroke="var(--color-brand)" stroke-width="2.5" class="core-bg" />

        <!-- CAPFLUX geometric logo - interlocking diamond knot -->
        <g class="core-logo" transform="translate(298, 88) scale(0.05)">
          <path style="fill:#5df7da" d="m 531.62558,1265.4086 c -3.025,-0.4478 -6.625,-1.3056 -8,-1.9063 -2.5,-1.0921 -2.5,-1.0921 0,-0.5348 1.375,0.3066 6.3665,1.058 11.09223,1.6698 15.94648,2.0647 33.21391,-2.6772 46.55971,-12.7858 4.90033,-3.7117 31.44324,-28.6187 79.80094,-74.8826 12.07409,-11.5512 27.59909,-26.383 34.5,-32.9595 18.07117,-17.2216 58.00264,-55.5792 76.04712,-73.0499 8.525,-8.2539 26.975,-26.0152 41,-39.4697 34.96378,-33.54128 37.82122,-36.46269 38.56574,-39.42912 0.96826,-3.85785 -0.26205,-7.34905 -3.28843,-9.33143 -2.51352,-1.64644 -7.9681,-1.76265 -82.73412,-1.76265 -79.88479,0 -80.05704,0.004 -87.04319,2.21714 -8.0469,2.54873 -15.09782,6.98665 -26.18142,16.47883 -20.91245,17.90983 -33.78196,23.75713 -52.35848,23.78923 -13.49335,0.023 -24.45791,-3.5373 -37.12847,-12.0574 -3.53727,-2.3785 -20.45429,-18.20434 -38.33163,-35.85907 -85.57657,-84.511 -140.18819,-137.54266 -144.5,-140.31949 -4.40383,-2.8361 -40.84296,-10.85774 -64.5,-14.19891 -36.93031,-5.2158 -84.14134,-8.74869 -85.58991,-6.40485 -1.12938,1.82738 -5.49735,-1.88535 -20.32789,-17.27852 -13.30242,-13.80707 -16.32625,-17.96007 -9.01844,-12.38612 2.96652,2.26267 4.00708,2.57194 5.77722,1.71711 2.2454,-1.08433 8.12749,-3.09024 15.39457,-5.24983 2.32955,-0.69228 5.00157,-2.10515 5.93783,-3.1397 1.99074,-2.19974 8.03106,-5.01554 17.82662,-8.31018 6.87824,-2.31342 23.37955,-8.19863 34.79827,-12.41083 3.18905,-1.1764 7.80155,-2.41348 10.25,-2.74908 2.44845,-0.3356 4.45173,-0.9343 4.45173,-1.33045 0,-0.39615 -1.51567,-2.70529 -3.36816,-5.13142 -14.41029,-18.87259 -15.32022,-40.89775 -2.40955,-58.32404 2.26715,-3.0601 16.52567,-16.92376 31.6856,-30.80812 32.46131,-29.73001 87.75529,-80.71149 107.59211,-99.20078 7.7,-7.17693 16.7,-15.48725 20,-18.46738 7.69621,-6.9502 43.07618,-40.76079 65,-62.11675 22.1181,-21.5452 31.17989,-27.50731 49.50917,-32.57409 8.90333,-2.46115 29.8712,-2.44946 38.99083,0.0217 12.79902,3.46823 16.89265,6.48762 41.12177,30.33067 16.56454,16.3006 23.92797,22.8639 27.5,24.5118 4.87823,2.25053 4.87823,2.25053 91.26984,2.52737 79.77538,0.25563 86.53393,0.14803 88.25,-1.40499 1.93113,-1.74765 2.4773,-6.84728 0.98539,-9.2006 C 850.28927,492.90703 792.13366,434.4604 721.51789,363.75645 588.13214,230.20413 588.12015,230.19279 573.03182,223.35142 c -10.65253,-4.83009 -18.34346,-6.25754 -33.40624,-6.20024 -19.9889,0.076 -33.34059,4.22471 -48.5,15.07008 -6.66364,4.7673 -35.09868,30.96583 -61,56.20213 -6.6,6.43054 -21.45,20.69397 -33,31.6965 -11.55,11.00253 -32.025,30.51555 -45.5,43.36226 -23.33078,22.24296 -84.88183,79.62073 -95.5,89.02491 -2.75,2.43559 -9.95,8.94624 -16,14.4681 -6.05,5.52186 -13.27793,12.05388 -16.06207,14.5156 -9.74403,8.6156 -34.99673,31.40419 -41.45807,37.41267 -3.58608,3.33475 -12.12485,11.01317 -18.97504,17.06317 -6.85019,6.05 -17.64112,15.73565 -23.97985,21.52366 -6.33874,5.78801 -22.54997,20.38523 -36.02497,32.43827 -13.474996,12.05303 -27.651817,24.86738 -31.504042,28.47633 -3.852225,3.60896 -16.29669,14.83383 -27.654367,24.94417 -26.077082,23.2132 -31.749039,30.61586 -35.903196,46.85846 -3.789334,14.81615 -1.641451,31.94522 5.637973,44.96205 3.936104,7.03841 11.26174,15.12465 61.010655,67.34528 18.102141,19.00152 47.312977,49.81851 64.912977,68.4822 17.6,18.66368 41.01169,43.39198 52.02597,54.95178 24.86406,26.0955 59.52563,62.84985 100.45272,106.5178 17.26853,18.425 48.74554,51.725 69.94889,74 59.7032,62.7207 71.54762,75.1941 103.38151,108.8715 16.30981,17.2543 32.24996,33.4069 35.42256,35.8947 3.17259,2.4878 8.91835,6.0508 12.76835,7.9177 3.85,1.8669 5.875,3.0935 4.5,2.7257 -10.53965,-2.819 -19.56331,-10.3491 -46.5,-38.804 -36.25104,-38.2941 -70.32811,-74.171 -105.5,-111.0719 -17.875,-18.7538 -52.741,-55.6833 -77.48,-82.0657 -24.73901,-26.3824 -50.85275,-54.043 -58.03054,-61.468 -7.17779,-7.425 -27.43679,-28.78925 -45.01999,-47.47612 C 168.51184,902.30361 144.45058,876.87693 132.62558,864.48675 113.47642,844.42234 52.328895,780.04191 29.583508,755.99679 18.841036,744.64047 15.643868,740.4826 11.874585,732.9666 7.062263,723.37077 5.275551,714.20834 5.881009,702.23094 c 1.032122,-20.41783 7.327561,-31.92138 27.766349,-50.737 12.207185,-11.23773 32.322242,-29.4387 45.894529,-41.52734 3.705012,-3.3 18.152357,-16.35 32.105193,-29 13.95285,-12.65 33.0435,-29.91137 42.42366,-38.3586 28.37902,-25.55649 53.30436,-48.05939 65.50799,-59.1414 6.35949,-5.775 17.83484,-16.125 25.50077,-23 14.86016,-13.32696 64.73439,-59.40204 80.58487,-74.44636 29.43911,-27.94181 77.61233,-73.97851 98.96121,-94.57221 58.78867,-56.70912 67.80558,-64.38569 83.10236,-70.74942 15.32039,-6.37354 38.46532,-7.97577 54.39764,-3.76574 7.926,2.0944 21.76329,8.74281 28,13.45317 2.75,2.07698 26.14069,25.10727 51.97931,51.17844 25.83862,26.07117 84.00112,84.53614 129.25,129.92217 75.69298,75.92241 82.27069,82.78355 82.27069,85.81574 0,4.54799 -1.4092,6.76261 -5.12811,8.05903 -4.2644,1.48657 -159.61258,1.5319 -168.87189,0.0493 -11.23577,-1.7991 -13.93995,-3.71789 -36,-25.54432 -23.29975,-23.053 -24.54986,-24.14666 -31.76535,-27.79022 -8.67455,-4.38032 -16.41629,-5.88468 -30.23465,-5.87515 -14.4969,0.01 -23.55304,2.001 -34.7504,7.6399 -7.21889,3.63538 -22.27692,14.41692 -24.49011,17.53491 -4.37858,6.16865 -72.98239,70.85772 -163.25949,153.94343 -33,30.37124 -62.79991,58.40677 -66.22203,62.30118 -8.80954,10.02535 -10.77797,15.39492 -10.77797,29.40071 0,10.84047 0.0759,11.20838 3.91886,19 3.6774,7.45592 5.77228,9.79389 34,37.94547 16.54463,16.5 36.77093,36.3 44.94735,44 26.1429,24.61964 79.34466,76.42873 136.45781,132.88573 60.03359,59.34394 64.27049,62.97464 79.42535,68.06194 6.30304,2.1159 9.4542,2.5503 18.42695,2.5405 20.10695,-0.022 29.10715,-4.0942 52.91313,-23.94036 11.81653,-9.85101 21.81183,-15.47565 30.29704,-17.04902 5.87853,-1.09003 156.65437,-1.44062 161.97431,-0.37663 4.85885,0.97177 8.1392,4.89218 8.1392,9.72732 0,3.9254 -0.54759,4.61832 -14.75,18.66459 -8.1125,8.0233 -30.5,29.636 -49.75,48.0282 -19.25,18.3921 -42.2,40.4192 -51,48.9491 -23.39608,22.6778 -57.02665,54.8624 -89.93633,86.0694 -15.91498,15.0916 -35.93998,34.1245 -44.5,42.2955 -8.56002,8.1709 -18.31161,16.8268 -21.67021,19.2354 -15.18203,10.8874 -31.57899,14.9873 -49.39346,12.3503 z m 86.25,-301.65825 c 1.5125,-0.22913 3.9875,-0.22913 5.5,0 1.5125,0.22912 0.275,0.41659 -2.75,0.41659 -3.025,0 -4.2625,-0.18747 -2.75,-0.41659 z m -12.02661,-2.85972 c -3.98075,-1.98369 -11.55595,-9.12907 -32.94635,-31.07694 -15.27737,-15.67554 -28.90204,-30.37885 -30.27704,-32.67403 -3.10616,-5.18487 -3.44199,-15.12835 -0.69998,-20.72543 1.44728,-2.95425 69.02064,-69.77204 189.5545,-187.43501 25.16122,-24.56192 66.14548,-67.43837 66.14548,-69.19933 0,-0.93506 -16.40044,-18.15749 -36.44542,-38.27206 -20.04499,-20.11457 -36.85817,-37.6877 -37.36264,-39.05141 -1.2873,-3.47991 0.38216,-7.57077 3.64036,-8.92036 1.93211,-0.8003 23.93507,-1.04102 77.1851,-0.84443 74.4826,0.27497 74.4826,0.27497 79.25971,2.64784 3.6443,1.81018 13.47002,11.45353 41.4353,40.66622 20.16201,21.06135 37.57365,40.01855 38.69254,42.12713 2.54075,4.78812 2.73185,15.3474 0.35955,19.86753 -1.82996,3.48677 -20.57502,22.18299 -137.81295,137.45386 -31.59835,31.06819 -60.17887,59.19319 -63.51225,62.5 -17.63114,17.49058 -62.78585,61.7312 -90.97142,89.12983 -31.43634,30.55864 -38.74071,36.55901 -44.18464,36.29661 -1.19634,-0.0577 -0.96044,-0.33715 0.71676,-0.84918 7.03847,-2.14876 12.67371,-6.46429 28,-21.44272 41.49733,-40.55547 128.70819,-126.25263 160,-157.22293 18.975,-18.78003 44.85,-44.367 57.5,-56.85993 65.31209,-64.50114 87.44126,-86.89573 88.89682,-89.96309 2.37091,-4.99632 2.07472,-13.40298 -0.64682,-18.35875 -1.2375,-2.25341 -14.175,-16.58998 -28.75,-31.85903 -44.48992,-46.60851 -46.84337,-48.88575 -52.42814,-50.73054 -4.36808,-1.44288 -12.9483,-1.62517 -75.5,-1.60402 -38.81452,0.0131 -72.32519,0.43057 -74.46815,0.92768 -3.77589,0.8759 -5.55674,2.3612 -5.5884,4.66096 -0.0301,2.18963 6.58302,9.36939 39.79734,43.20718 18.52804,18.87582 33.82918,35.17329 34.00252,36.2166 0.46397,2.79246 -36.00541,40.24723 -93.63693,96.16696 C 599.5041,818.81221 545.1248,872.53595 543.04495,876.4666 c -2.49014,4.70603 -2.5217,15.24923 -0.0594,19.8478 2.26443,4.22907 55.81485,59.47908 60.39002,62.30669 1.86911,1.15517 5.2775,2.68788 7.57421,3.40602 2.2967,0.71813 3.25167,1.3358 2.12216,1.37259 -1.12951,0.0368 -4.37984,-1.09229 -7.22295,-2.50907 z m 131.44402,1.63727 c -19.10515,-0.51476 -20.95013,-0.72226 -22.25,-2.50243 -1.49057,-2.04132 -1.79048,-4.42308 -0.86173,-6.84338 0.56759,-1.47912 22.80117,-22.45991 57.18905,-53.96663 27.92065,-25.58134 58.06397,-53.71422 58.43479,-54.53741 0.28628,-0.63553 11.49963,-11.1645 59.30616,-55.68662 40.74171,-37.94265 71.93553,-67.92667 107.18022,-103.02337 43.79092,-43.60706 44.72482,-44.78505 44.79512,-56.50146 0.033,-5.44478 -0.448,-7.3422 -2.961,-11.68785 -2.8247,-4.88476 -32.7795,-35.83759 -127.56206,-131.81215 C 841.32253,415.85477 749.02213,322.99741 683.49899,257.53193 638.71792,212.79026 613.16313,186.53924 611.88475,183.9666 c -4.99716,-10.05643 -5.24211,-20.62663 -0.70494,-30.41965 3.00032,-6.47588 9.71499,-13.52809 40.59323,-42.63377 25.09597,-23.655351 30.87649,-28.175723 40.39167,-31.586332 7.31819,-2.623121 23.47757,-3.621375 31.53711,-1.948222 7.31132,1.517825 16.95578,6.149605 23.30554,11.192558 10.60986,8.426301 86.87096,83.483766 195.11822,192.038676 61.60002,61.77507 114.48502,114.80195 117.52232,117.83752 3.0372,3.03557 10.2103,10.46922 15.9402,16.51922 17.8462,18.84321 41.2838,42.81038 106.2513,108.65185 72.3568,73.33009 68.2912,68.21841 68.2788,85.84815 -0.01,10.08648 -0.1545,10.80165 -3.744,18.15936 -3.5685,7.31487 -5.1648,9.02681 -35.4926,38.06346 -41.8222,40.04177 -75.3009,71.4499 -168.7114,158.27718 -16.5676,15.4 -42.93032,39.94823 -58.58377,54.55162 -15.65347,14.60339 -30.93585,28.77696 -33.96085,31.49682 -3.025,2.71985 -11.575,10.60201 -19,17.51591 -25.77117,23.99719 -33.37692,29.27374 -47.60121,33.02376 -7.51757,1.9819 -10.72217,2.09331 -66.39879,2.30845 -32.175,0.12432 -67.87467,-0.0265 -79.33259,-0.33526 z m 140.99462,-2.55896 c 9.23112,-1.76385 21.68228,-7.49106 29.09751,-13.38408 2.89275,-2.29892 12.11775,-10.55672 20.5,-18.35067 8.38225,-7.79395 17.49545,-16.21759 20.25155,-18.7192 6.93446,-6.29416 68.57423,-63.64087 105.38853,-98.04839 16.7714,-15.675 34.382,-32.1 39.1346,-36.5 34.4163,-31.86264 71.8891,-67.15939 119.0307,-112.11873 30.6329,-29.21479 34.7211,-34.21637 37.0203,-45.29163 1.686,-8.12169 0.5354,-17.3867 -3.0684,-24.70714 -2.6205,-5.323 -12.076,-15.26265 -72.7735,-76.5002 -68.1428,-68.74901 -82.5826,-83.5771 -112.2433,-115.26144 C 1046.0018,385.46588 895.13174,234.46907 838.62558,178.90085 797.05825,138.0235 752.0902,94.710601 746.59071,90.25353 736.67606,82.218188 724.53783,78.075643 711.12558,78.149962 c -13.80293,0.07648 -24.79644,3.986372 -35.0633,12.470411 -10.7552,8.887579 -57.54776,54.298427 -60.42217,58.638007 -4.42416,6.67926 -6.40084,14.23813 -5.63626,21.55322 1.23592,11.8246 3.33056,14.68844 31.41308,42.94864 14.13976,14.22922 27.28365,26.68121 29.20865,27.67109 1.925,0.98987 14.975,6.61576 29,12.50197 70.0595,29.40357 106.90363,45.17681 144.39084,61.81477 21.4664,9.52744 39.42087,18.32865 33.10916,16.22997 -1.1,-0.36575 -6.5,-2.16709 -12,-4.00296 -5.5,-1.83588 -12.7,-3.65935 -16,-4.05216 -3.3,-0.39282 -7.8,-1.63898 -10,-2.76925 -3.32572,-1.70863 -5.6295,-2.02286 -13.66659,-1.8641 -5.56528,0.10994 -10.86873,-0.30593 -12.5,-0.98019 -1.87798,-0.77624 -11.93786,-1.24122 -29.83341,-1.37894 -14.85,-0.11428 -28.35,-0.56361 -30,-0.99851 -1.65,-0.4349 -4.69665,-1.90836 -6.77033,-3.27436 -12.69077,-8.35985 0.3476,5.58683 86.72206,92.76341 62.68324,63.26534 96.48886,97.60238 121.64092,123.55311 6.92596,7.14588 28.23537,28.96751 47.35427,48.49251 19.1189,19.525 35.9522,37.525 37.4074,40 2.2258,3.78577 2.6457,5.69039 2.6457,12 0,11.93365 -0.8122,12.95287 -46.69412,58.59707 -45.18757,44.95343 -58.17525,57.35152 -139.07,132.75663 -15.25474,14.21954 -27.7359,26.25704 -27.7359,26.75 0,0.49297 0.675,0.8963 1.5,0.8963 3.56559,0 0.23904,4.25161 -5.03463,6.43467 -2.18095,0.90281 -6.66537,4.28469 -9.96537,7.51528 -3.3,3.23059 -11.43047,10.75096 -18.0677,16.71193 -61.58772,55.31254 -81.4323,74.02504 -81.4323,76.7868 0,5.29303 -3.55571,5.07487 87.16203,5.34777 56.56177,0.17016 68.94789,-0.0422 75.5,-1.29411 z M 838.78455,845.35773 c 0.4205,-1.3937 11.5463,-7.5192 12.29582,-6.76967 0.2191,0.21909 -1.31086,1.83333 -3.39991,3.58719 -4.27997,3.59325 -9.59336,5.4941 -8.89591,3.18248 z m 18.84103,-10.28414 c 0,-0.21616 0.69837,-0.661 1.55194,-0.98855 0.88992,-0.34149 1.29132,-0.17385 0.94098,0.39301 -0.58726,0.95021 -2.49292,1.40545 -2.49292,0.59554 z m 13.08333,-6.97981 c 1.02905,-0.92077 6.91667,-3.62641 6.91667,-3.17854 0,0.57598 -5.54382,3.55136 -6.61701,3.55136 -0.39398,0 -0.52882,-0.16777 -0.29966,-0.37282 z m -374.75135,21.47089 c -6.57699,-1.68563 -12.31772,-6.40263 -28.66301,-23.55161 -18.68762,-19.60647 -20.84765,-22.99887 -20.8014,-32.66932 0.059,-12.33118 1.80862,-14.5112 45.1831,-56.29735 7.94713,-7.65611 23.44933,-22.73757 34.44933,-33.51436 26.7019,-26.16008 110.15662,-106.98093 124.1653,-120.2466 12.19299,-11.54628 16.44801,-13.827 25.76284,-13.80906 9.39913,0.0181 13.27495,2.76737 33.60402,23.83661 10.15731,10.52714 19.31371,20.74573 20.34756,22.70798 2.53064,4.8032 3.15074,11.4359 1.60762,17.19541 -1.49412,5.57662 1.77704,2.24162 -99.33707,101.27568 -36.76735,36.011 -77.04235,75.47846 -89.5,87.70547 -15.94079,15.64566 -24.17082,22.99496 -27.78345,24.8102 -5.52606,2.77668 -13.82681,3.89172 -19.03484,2.55695 z m 18.22791,-3.02154 c 3.56696,-1.57783 11.77595,-9.06628 33.82507,-30.85605 47.71084,-47.14967 157.32596,-154.96449 168.48992,-165.72268 5.93693,-5.72115 11.16759,-11.70884 12.22804,-13.9978 2.12597,-4.58886 2.43,-13.56552 0.60198,-17.77375 -1.68871,-3.88752 -37.32564,-40.39036 -42.28587,-43.31333 -5.69275,-3.35464 -11.85868,-4.00844 -18.79266,-1.99268 -5.27378,1.53313 -7.43256,3.30074 -30.36759,24.86511 -13.57961,12.76806 -33.24087,31.53965 -43.69167,41.71465 -10.45081,10.175 -26.63788,25.925 -35.97128,35 -9.33339,9.075 -26.89816,26.19291 -39.03282,38.0398 -12.13465,11.84689 -31.06301,30.26658 -42.06301,40.93264 -11,10.66607 -21.63749,21.53928 -23.63887,24.16271 -6.01513,7.8847 -7.42177,18.748 -3.4838,26.90502 1.63919,3.39539 30.72982,34.89647 36.19924,39.19872 7.43042,5.84477 18.62007,6.97946 27.98332,2.83764 z M 240.19656,827.35747 c -3.07461,-2.81001 -6.5923,-6.51644 -7.81708,-8.23649 -2.22688,-3.12736 -2.22688,-3.12736 0.76262,-0.99865 3.12598,2.22589 13.48348,12.81456 13.48348,13.78441 0,1.12993 -0.9527,0.45578 -6.42902,-4.54927 z" />
        </g>

        <!-- Pulse burst -->
        <circle cx="330" cy="120" r="52" fill="none" stroke="var(--color-brand)" stroke-width="2" class="capflux-pulse" opacity="0" />
      </g>

      <!-- ====== VERIFICATION BADGE ====== -->
      <g class="verification-badge">
        <rect x="270" y="18" width="150" height="40" rx="20" fill="var(--color-card)" stroke="var(--color-success)" stroke-width="1.5" />
        <circle cx="296" cy="38" r="12" fill="var(--color-success-soft)" />
        <path d="M291 38 L294.5 41.5 L302 34" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="verification-check" />
        <text x="314" y="35" class="verification-text">Payment Verified</text>
        <text x="314" y="50" class="verification-subtext">in seconds</text>
      </g>

      <!-- CAPFLUX label -->
      <text x="330" y="208" text-anchor="middle" class="capflux-label-text">CAPFLUX</text>
      <text x="330" y="226" text-anchor="middle" class="capflux-subtext">Verifies, allocates and</text>
      <text x="330" y="240" text-anchor="middle" class="capflux-subtext">reconciles automatically</text>

      <!-- Down arrow from CAPFLUX -->
      <path d="M330 250 L330 270" stroke="var(--color-brand)" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.4" />
      <path d="M325 266 L330 274 L335 266" fill="var(--color-brand)" opacity="0.4" />

      <!-- ====== STUDENT ACCOUNTS ====== -->
      <g class="student-accounts">
        <text x="490" y="22" text-anchor="middle" class="section-label">Individual Student Accounts</text>
        <text x="490" y="38" text-anchor="middle" class="section-sublabel">Each student gets a dedicated bank account</text>

        <!-- Card 1: Tunde A. -->
        <g class="student-card active-card-1" filter="url(#card-shadow)">
          <rect x="405" y="52" width="175" height="58" rx="12" fill="var(--color-card)" stroke="var(--color-brand)" stroke-width="1.5" class="card-border" />
          <circle cx="432" cy="81" r="16" fill="var(--color-brand-soft)" />
          <text x="432" y="86" text-anchor="middle" class="avatar-text">T</text>
          <text x="456" y="72" class="student-name">Tunde A.</text>
          <text x="456" y="86" class="student-class">10A · JSS 1</text>
          <text x="456" y="100" class="student-amount">₦120,000</text>
          <circle cx="562" cy="81" r="10" fill="var(--color-success-soft)" />
          <path d="M558 81 L561 84 L567 77" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 2: Amina B. -->
        <g class="student-card active-card-2" filter="url(#card-shadow)">
          <rect x="405" y="120" width="175" height="58" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="432" cy="149" r="16" fill="var(--color-brand-soft)" />
          <text x="432" y="154" text-anchor="middle" class="avatar-text">A</text>
          <text x="456" y="140" class="student-name">Amina B.</text>
          <text x="456" y="154" class="student-class">8B · JSS 2</text>
          <text x="456" y="168" class="student-amount">₦95,000</text>
          <circle cx="562" cy="149" r="10" fill="var(--color-success-soft)" />
          <path d="M558 149 L561 152 L567 145" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 3: Chidi K. -->
        <g class="student-card active-card-3" filter="url(#card-shadow)">
          <rect x="405" y="188" width="175" height="58" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="432" cy="217" r="16" fill="var(--color-brand-soft)" />
          <text x="432" y="222" text-anchor="middle" class="avatar-text">C</text>
          <text x="456" y="208" class="student-name">Chidi K.</text>
          <text x="456" y="222" class="student-class">11C · SS 1</text>
          <text x="456" y="236" class="student-amount">₦120,000</text>
          <circle cx="562" cy="217" r="10" fill="var(--color-success-soft)" />
          <path d="M558 217 L561 220 L567 213" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>

        <!-- Card 4: Zainab S. -->
        <g class="student-card active-card-4" filter="url(#card-shadow)">
          <rect x="405" y="256" width="175" height="58" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" class="card-border" />
          <circle cx="432" cy="285" r="16" fill="var(--color-brand-soft)" />
          <text x="432" y="290" text-anchor="middle" class="avatar-text">Z</text>
          <text x="456" y="276" class="student-name">Zainab S.</text>
          <text x="456" y="290" class="student-class">9A · JSS 3</text>
          <text x="456" y="304" class="student-amount">₦75,000</text>
          <circle cx="562" cy="285" r="10" fill="var(--color-success-soft)" />
          <path d="M558 285 L561 288 L567 281" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-mark" />
        </g>
      </g>

      <!-- ====== CONNECTIONS TO STUDENTS ====== -->
      <g class="student-connections" opacity="0.35">
        <path d="M 382 120 C 400 120, 405 81, 405 81" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" class="account-path" />
        <path d="M 382 120 C 400 120, 405 149, 405 149" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" class="account-path" />
        <path d="M 382 120 C 400 120, 405 217, 405 217" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" class="account-path" />
        <path d="M 382 120 C 400 120, 405 285, 405 285" stroke="var(--color-brand)" stroke-width="1" stroke-dasharray="3 3" class="account-path" />
      </g>

      <!-- ====== RECENT TRANSACTIONS PANEL ====== -->
      <g class="transaction-panel" filter="url(#card-shadow)">
        <rect x="600" y="10" width="115" height="310" rx="12" fill="var(--color-card)" stroke="var(--color-border)" stroke-width="1" />
        <text x="657" y="34" text-anchor="middle" class="panel-header">Recent Transactions</text>
        <line x1="612" y1="42" x2="702" y2="42" stroke="var(--color-divider)" stroke-width="0.5" />

        <!-- Row 1 -->
        <g class="transaction-row row-1">
          <circle cx="618" cy="62" r="6" fill="var(--color-brand-soft)" />
          <text x="630" y="65" class="tx-name">Tunde A.</text>
          <text x="695" y="65" text-anchor="end" class="tx-amount">₦120k</text>
          <text x="695" y="77" text-anchor="end" class="tx-time">Just now</text>
        </g>

        <!-- Row 2 -->
        <g class="transaction-row row-2">
          <circle cx="618" cy="100" r="6" fill="var(--color-brand-soft)" />
          <text x="630" y="103" class="tx-name">Amina B.</text>
          <text x="695" y="103" text-anchor="end" class="tx-amount">₦95k</text>
          <text x="695" y="115" text-anchor="end" class="tx-time">12 mins ago</text>
        </g>

        <!-- Row 3 -->
        <g class="transaction-row row-3">
          <circle cx="618" cy="138" r="6" fill="var(--color-brand-soft)" />
          <text x="630" y="141" class="tx-name">Chidi K.</text>
          <text x="695" y="141" text-anchor="end" class="tx-amount">₦120k</text>
          <text x="695" y="153" text-anchor="end" class="tx-time">1 hour ago</text>
        </g>

        <!-- Row 4 -->
        <g class="transaction-row row-4">
          <circle cx="618" cy="176" r="6" fill="var(--color-brand-soft)" />
          <text x="630" y="179" class="tx-name">Zainab S.</text>
          <text x="695" y="179" text-anchor="end" class="tx-amount">₦75k</text>
          <text x="695" y="191" text-anchor="end" class="tx-time">2 hours ago</text>
        </g>

        <line x1="612" y1="205" x2="702" y2="205" stroke="var(--color-divider)" stroke-width="0.5" />

        <!-- Reconciliation state -->
        <g class="reconciliation-state">
          <circle cx="620" cy="228" r="8" fill="var(--color-success-soft)" />
          <path d="M617 228 L619.5 231 L624 225" stroke="var(--color-success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="recon-check" />
          <text x="634" y="231" class="recon-text">All payments verified</text>
          <text x="634" y="245" class="recon-subtext">No manual checks. No missing payments.</text>
        </g>
      </g>

    </svg>
  </div>
</template>

<style scoped>
.capflux-payment-flow {
  --cycle-duration: 6s;
  --payment-duration: 1.2s;
  --easing: cubic-bezier(0.22, 1, 0.36, 1);
  --brand: var(--color-brand);
  --brand-soft: var(--color-brand-soft);
  --success: var(--color-success);
  --success-soft: var(--color-success-soft);
  --card: var(--color-card);
  --border: var(--color-border);
  --divider: var(--color-divider);
  --text-primary: var(--color-text-primary);
  --text-secondary: var(--color-text-secondary);
  --text-muted: var(--color-text-muted);
}

.payment-flow-svg {
  width: 100%;
  height: auto;
  max-width: 720px;
  display: block;
}

/* ====== TYPOGRAPHY ====== */
.label-school {
  font-size: 13px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.text-amount {
  font-size: 16px;
  font-weight: 700;
  fill: var(--brand);
  font-family: var(--font-family-mono);
}

.text-muted {
  font-size: 10px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.text-muted-small {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.verification-text {
  font-size: 11px;
  font-weight: 600;
  fill: var(--success);
  font-family: var(--font-family-sans);
}

.verification-subtext {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.capflux-label-text {
  font-size: 13px;
  font-weight: 700;
  fill: var(--text-secondary);
  font-family: var(--font-family-sans);
  letter-spacing: 0.5px;
}

.capflux-subtext {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text-secondary);
  font-family: var(--font-family-sans);
}

.section-sublabel {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.student-name {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.student-class {
  font-size: 9px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.student-amount {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-mono);
}

.avatar-text {
  font-size: 11px;
  font-weight: 700;
  fill: var(--brand);
  font-family: var(--font-family-sans);
}

.panel-header {
  font-size: 11px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.tx-name {
  font-size: 9px;
  font-weight: 600;
  fill: var(--text-primary);
  font-family: var(--font-family-sans);
}

.tx-amount {
  font-size: 9px;
  font-weight: 700;
  fill: var(--text-primary);
  font-family: var(--font-family-mono);
}

.tx-time {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

.recon-text {
  font-size: 9px;
  font-weight: 600;
  fill: var(--success);
  font-family: var(--font-family-sans);
}

.recon-subtext {
  font-size: 7px;
  fill: var(--text-muted);
  font-family: var(--font-family-sans);
}

/* ====== ANIMATIONS ====== */

/* CAPFLUX core ring pulse */
.core-ring-outer {
  animation: ring-pulse var(--cycle-duration) var(--easing) infinite;
  transform-origin: 330px 120px;
}

.core-ring-inner {
  animation: ring-pulse-inner var(--cycle-duration) var(--easing) infinite;
  transform-origin: 330px 120px;
}

@keyframes ring-pulse {
  0%, 40%, 100% { opacity: 0.12; transform: scale(1); }
  50%, 60% { opacity: 0.25; transform: scale(1.04); }
}

@keyframes ring-pulse-inner {
  0%, 40%, 100% { opacity: 0.08; transform: scale(1); }
  50%, 60% { opacity: 0.15; transform: scale(1.03); }
}

/* CAPFLUX pulse burst */
.capflux-pulse {
  animation: core-activate var(--cycle-duration) var(--easing) infinite;
  transform-origin: 330px 120px;
}

@keyframes core-activate {
  0%, 42%, 100% { opacity: 0; r: 52; }
  48% { opacity: 0.35; r: 58; }
  55% { opacity: 0; r: 68; }
}

/* Verification badge */
.verification-badge {
  animation: verification-in var(--cycle-duration) var(--easing) infinite;
}

@keyframes verification-in {
  0%, 48%, 100% { opacity: 0; transform: translateY(6px); }
  54%, 92% { opacity: 1; transform: translateY(0); }
}

.verification-check {
  animation: check-draw var(--cycle-duration) var(--easing) infinite;
  stroke-dasharray: 14;
  stroke-dashoffset: 14;
}

@keyframes check-draw {
  0%, 52%, 100% { stroke-dashoffset: 14; }
  58%, 90% { stroke-dashoffset: 0; }
}

/* Connection path flow */
.connection-path {
  animation: path-flow var(--cycle-duration) linear infinite;
}

@keyframes path-flow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -20; }
}

/* Account paths */
.account-path {
  animation: account-flow var(--cycle-duration) linear infinite;
}

@keyframes account-flow {
  0% { stroke-dashoffset: 0; opacity: 0.35; }
  50% { opacity: 0.55; }
  100% { stroke-dashoffset: -14; opacity: 0.35; }
}

/* Student card highlight sequence */
.student-card {
  animation: card-highlight var(--cycle-duration) var(--easing) infinite;
}

.active-card-1 { animation-delay: 0s; }
.active-card-2 { animation-delay: calc(var(--cycle-duration) * 0.2); }
.active-card-3 { animation-delay: calc(var(--cycle-duration) * 0.4); }
.active-card-4 { animation-delay: calc(var(--cycle-duration) * 0.6); }

@keyframes card-highlight {
  0%, 55%, 100% { transform: translateY(0); }
  60%, 70% { transform: translateY(-2px); }
}

.active-card-1 .card-border { animation: border-emphasis 6s var(--easing) infinite; }
.active-card-2 .card-border { animation: border-emphasis 6s var(--easing) infinite; animation-delay: 1.2s; }
.active-card-3 .card-border { animation: border-emphasis 6s var(--easing) infinite; animation-delay: 2.4s; }
.active-card-4 .card-border { animation: border-emphasis 6s var(--easing) infinite; animation-delay: 3.6s; }

@keyframes border-emphasis {
  0%, 55%, 100% { stroke: var(--border); stroke-width: 1; }
  60%, 70% { stroke: var(--brand); stroke-width: 2; }
}

/* Transaction row highlight */
.transaction-row {
  animation: tx-highlight var(--cycle-duration) var(--easing) infinite;
}

.row-1 { animation-delay: 0s; }
.row-2 { animation-delay: calc(var(--cycle-duration) * 0.2); }
.row-3 { animation-delay: calc(var(--cycle-duration) * 0.4); }
.row-4 { animation-delay: calc(var(--cycle-duration) * 0.6); }

@keyframes tx-highlight {
  0%, 55%, 100% { opacity: 1; }
  60%, 70% { opacity: 0.7; }
}

/* Reconciliation state */
.reconciliation-state {
  animation: recon-in var(--cycle-duration) var(--easing) infinite;
}

.recon-check {
  animation: recon-check-draw var(--cycle-duration) var(--easing) infinite;
  stroke-dasharray: 10;
  stroke-dashoffset: 10;
}

@keyframes recon-in {
  0%, 54%, 100% { opacity: 0; }
  58%, 92% { opacity: 1; }
}

@keyframes recon-check-draw {
  0%, 56%, 100% { stroke-dashoffset: 10; }
  60%, 90% { stroke-dashoffset: 0; }
}

/* ====== REDUCED MOTION ====== */
.reduced-motion .payment-particle,
.reduced-motion .core-ring-outer,
.reduced-motion .core-ring-inner,
.reduced-motion .capflux-pulse,
.reduced-motion .verification-badge,
.reduced-motion .verification-check,
.reduced-motion .connection-path,
.reduced-motion .account-path,
.reduced-motion .student-card,
.reduced-motion .card-border,
.reduced-motion .transaction-row,
.reduced-motion .reconciliation-state,
.reduced-motion .recon-check {
  animation: none !important;
}

.reduced-motion .verification-badge {
  opacity: 1;
}

.reduced-motion .verification-check {
  stroke-dashoffset: 0;
}

.reduced-motion .payment-particle {
  opacity: 0;
}

.reduced-motion .card-border {
  stroke: var(--border) !important;
  stroke-width: 1 !important;
}

.reduced-motion .reconciliation-state {
  opacity: 1;
}

.reduced-motion .recon-check {
  stroke-dashoffset: 0;
}

/* ====== RESPONSIVE ====== */
@media (max-width: 1024px) {
  .payment-flow-svg {
    max-width: 600px;
  }
}

@media (max-width: 768px) {
  .capflux-payment-flow {
    max-width: 420px;
    margin: 0 auto;
  }

  .payment-flow-svg {
    max-width: 420px;
  }

  .student-card:nth-child(4) {
    display: none;
  }

  .transaction-panel {
    display: none;
  }

  .student-connections {
    display: none;
  }
}

@media (max-width: 430px) {
  .capflux-payment-flow {
    max-width: 340px;
  }

  .payment-flow-svg {
    max-width: 340px;
  }

  .student-card:nth-child(3) {
    display: none;
  }
}
</style>
