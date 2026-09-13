<script setup lang="ts">
import { computed, useAttrs } from 'vue';
import { LoaderCircle } from '@lucide/vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'black' | 'link';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
});

const isLinkVariant = (variant: Props['variant']) => variant === 'link';

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const variantClasses = {
  primary: 'bg-brand text-background border-transparent hover:bg-brand-hover active:bg-brand-active focus:ring-brand focus:ring-offset-2 transition-colors duration-150',
  black: 'bg-background text-text-primary border-border hover:bg-surface focus-ring transition-colors duration-150',
  secondary: 'bg-surface text-text-secondary border-border hover:bg-surface/80 focus-ring transition-colors duration-150',
  success: 'bg-success text-background border-transparent hover:bg-success-hover focus:ring-success transition-colors duration-150',
  danger: 'bg-danger text-background border-transparent hover:bg-danger-hover focus:ring-danger transition-colors duration-150',
  warning: 'bg-warning text-background border-transparent hover:bg-warning-hover focus:ring-warning transition-colors duration-150',
  info: 'bg-info text-background border-transparent hover:bg-info-hover focus:ring-info transition-colors duration-150',
  link: 'text-brand hover:text-brand-hover transition-colors duration-150',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs h-8',
  md: 'px-4 py-2.5 text-sm h-10',
  lg: 'px-6 py-3 text-base h-12',
};

const attrs = useAttrs();

const hasDisplayOverride = computed(() => {
  const cls = (attrs.class as string) ?? '';
  return /\b(hidden|block|inline|flex|inline-flex|inline-block|inline-grid)\b/.test(cls);
});

const baseClasses = computed(() => {
  const base: string[] = isLinkVariant(props.variant)
    ? ['font-medium focus-ring disabled:cursor-not-allowed disabled:opacity-50']
    : ['rounded-button font-medium items-center justify-center gap-2 focus-ring disabled:cursor-not-allowed disabled:opacity-50'];
  if (!hasDisplayOverride.value) {
    base.push('inline-flex');
  }
  base.push(variantClasses[props.variant]);
  if (!isLinkVariant(props.variant)) base.push(sizeClasses[props.size]);
  if (props.variant === 'primary') base.push('shadow-button');
  if (['success', 'danger', 'warning', 'info'].includes(props.variant)) base.push('shadow-sm');
  return base;
});
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    @click="emit('click', $event)"
    :class="baseClasses"
  >
    <LoaderCircle
      v-if="loading && !isLinkVariant(variant)"
      class="h-4 w-4 animate-spin"
      :stroke-width="2.5"
    />
    <slot />
  </button>
</template>