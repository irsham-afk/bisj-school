@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html { -webkit-font-smoothing: antialiased; }
  body { @apply bg-paper text-ink font-sans; }
  /* visible keyboard focus everywhere */
  :focus-visible { @apply outline-none ring-2 ring-brand/40 ring-offset-1 ring-offset-paper; }
}

@layer components {
  .ledger-grid {
    background-image:
      linear-gradient(to right, rgba(26,29,27,0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(26,29,27,0.04) 1px, transparent 1px);
    background-size: 28px 28px;
  }
}
