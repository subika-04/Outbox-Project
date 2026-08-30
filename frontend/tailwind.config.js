/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#F5F6F3',
          raised: '#FFFFFF',
        },
        ink: {
          DEFAULT: '#14171C',
          soft: '#484F5B',
          faint: '#8A909B',
        },
        line: '#E2E4E1',
        // Sampled directly from the pixel data of the provided Figma screenshots
        // (solid button fill = rgb(0,166,62) / #00A63E). The rest of the scale
        // is generated around that sample, not extracted from Figma tokens —
        // see README "Design source" section for the estimate caveat.
        brand: {
          50: '#EAFBF0',
          100: '#D2F5DC',
          200: '#A6EBBB',
          300: '#6FDA8E',
          400: '#34C065',
          500: '#00A63E',
          600: '#009236',
          700: '#067A2E',
          800: '#0B5C28',
          900: '#063D1B',
        },
        manifest: {
          scheduled: '#B8860B',
          scheduledBg: '#FBF3DF',
          processing: '#2A4B7C',
          processingBg: '#E9EFF7',
          sent: '#2F8F5B',
          sentBg: '#E7F5ED',
          failed: '#B3402A',
          failedBg: '#FBEAE6',
          cancelled: '#6B7280',
          cancelledBg: '#EEEFF1',
        },
      },
      fontFamily: {
        display: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        // Lightened from the original — the Figma screens read as flat,
        // border-led surfaces with little to no visible drop shadow.
        card: '0 1px 2px 0 rgba(20, 23, 28, 0.03)',
        popover: '0 8px 24px -4px rgba(20, 23, 28, 0.16)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
    },
  },
  plugins: [],
}
