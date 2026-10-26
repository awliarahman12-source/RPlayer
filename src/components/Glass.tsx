import { forwardRef, type HTMLAttributes } from 'react';

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'strong';
  radius?: 'lg' | 'xl' | 'pill';
  specular?: boolean;
};

const radiusMap = {
  lg: 'rounded-glasssm',
  xl: 'rounded-glass',
  pill: 'rounded-full',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  { variant = 'default', radius = 'xl', specular = false, className = '', children, ...rest },
  ref,
) {
  const base = variant === 'strong' ? 'glass-strong' : 'glass';
  return (
    <div
      ref={ref}
      className={`${base} ${radiusMap[radius]} ${specular ? 'specular' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
});

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'strong' | 'accent' | 'ghost';
  pill?: boolean;
  specular?: boolean;
}

const sizeMap = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { size = 'md', variant = 'default', pill = true, specular = false, className = '', children, ...rest },
  ref,
) {
  const base =
    variant === 'accent'
      ? 'glass-strong bg-white/25'
      : variant === 'ghost'
      ? 'bg-transparent border border-transparent'
      : variant === 'strong'
      ? 'glass-strong'
      : 'glass';
  return (
    <button
      ref={ref}
      className={`${base} ${pill ? 'rounded-full' : 'rounded-glasssm'} ${sizeMap[size]} tap ${
        specular ? 'specular' : ''
      } flex items-center justify-center text-white/90 hover:text-white active:text-white transition-colors ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
