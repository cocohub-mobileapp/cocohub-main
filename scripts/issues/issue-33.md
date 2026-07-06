## Bounty: 50 XLM

Audit every screen for dark mode correctness and fix all remaining hard-coded colors.

### Acceptance Criteria
- All screens pass visual dark mode review (no white background flashes, no unreadable text)
- All hard-coded color strings (#fff, #1a1a1a etc.) replaced with colors.* from ThemeContext
- StatusBar style correct in both modes
- Storybook stories updated to include dark mode variant

### Resources
- Theme: src/context/ThemeContext.tsx, src/theme/colors.ts
- Settings screen already has system/light/dark toggle

### Reward
50 XLM via GrantFox (https://grantfox.xyz) - released within 48h of merge.
