## Bounty: 10 XLM

WeightChart data points have no accessible labels - fails WCAG 2.1 AA.

### Acceptance Criteria
- Each data point has accessibilityLabel with date and weight value e.g. "June 1, 12.3 kg"
- Chart has a summary accessibilityLabel e.g. "Weight chart for Buddy, 8 data points, latest 12.3 kg"
- VoiceOver (iOS) and TalkBack (Android) can navigate the chart meaningfully

### Resources
- src/components/WeightChart.tsx
- src/components/weightChartAccessibility.ts (stub already exists)

### Reward
10 XLM via GrantFox (https://grantfox.xyz) - released within 48h of merge.
