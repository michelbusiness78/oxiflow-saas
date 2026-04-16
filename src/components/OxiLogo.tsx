interface OxiLogoProps {
  variant: 'oxilabs' | 'oxiflow' | 'oxinex';
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
}

const config = {
  oxilabs: {
    suffix: 'labs', slashColor: '#F59E0B', suffixWeight: 300,
    dark:  { suffixColor: '#F59E0B', prefixColor: '#F1F5F9' },
    light: { suffixColor: '#F59E0B', prefixColor: '#1E293B' },
  },
  oxiflow: {
    suffix: 'Flow', slashColor: '#3B82F6', suffixWeight: 700,
    dark:  { suffixColor: '#60A5FA', prefixColor: '#F1F5F9' },
    light: { suffixColor: '#2563EB', prefixColor: '#1E293B' },
  },
  oxinex: {
    suffix: 'Nex', slashColor: '#0891B2', suffixWeight: 700,
    dark:  { suffixColor: '#22D3EE', prefixColor: '#F1F5F9' },
    light: { suffixColor: '#0891B2', prefixColor: '#1E293B' },
  },
};

const sizes = {
  sm: { fontSize: 16, slashWidth: 2, height: 24 },
  md: { fontSize: 22, slashWidth: 3, height: 32 },
  lg: { fontSize: 28, slashWidth: 3, height: 40 },
};

export function OxiLogo({ variant, theme = 'dark', size = 'md' }: OxiLogoProps) {
  const c = config[variant];
  const colors = c[theme];
  const s = sizes[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: s.height,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <span style={{ fontSize: s.fontSize, fontWeight: 700, color: colors.prefixColor, lineHeight: 1 }}>
        Oxi
      </span>
      <svg width={s.fontSize * 0.5} height={s.height} style={{ margin: `0 ${s.fontSize * 0.1}px` }}>
        <line
          x1={s.fontSize * 0.35} y1={s.height * 0.15}
          x2={s.fontSize * 0.15} y2={s.height * 0.85}
          stroke={c.slashColor}
          strokeWidth={s.slashWidth}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          fontSize: s.fontSize,
          fontWeight: c.suffixWeight,
          color: colors.suffixColor,
          lineHeight: 1,
        }}
      >
        {c.suffix}
      </span>
    </span>
  );
}
