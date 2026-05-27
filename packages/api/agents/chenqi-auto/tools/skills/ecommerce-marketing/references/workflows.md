# Marketing Workflows

Detailed workflow sequences for common marketing scenarios. Read the relevant section based on the user's goal.

## Table of Contents

1. [Scenario: Product Launch on Shopify](#scenario-product-launch-on-shopify)
2. [Scenario: Instagram Marketing Campaign](#scenario-instagram-marketing-campaign)
3. [Scenario: Conversion Diagnosis ("Why aren't my ads converting?")](#scenario-conversion-diagnosis)
4. [Scenario: China Market Entry](#scenario-china-market-entry)
5. [End-to-End Launch Timeline (4-6 weeks)](#end-to-end-launch-timeline)
6. [Quick Start Packs](#quick-start-packs)

---

## Scenario: Product Launch on Shopify

**Skills (sequential, 7 steps):**

```
1. product-marketing-context (if not done yet)
   ↓ "Let's set up your product positioning first"
   ↓ Output: .claude/product-marketing-context.md

2. company-research + competitive-landscape (parallel)
   ↓ "Understanding your competitive landscape"
   ↓ Output: Market opportunity report + Competitor analysis

3. launch-strategy
   ↓ "Designing your 5-phase launch plan"
   ↓ Output: Phased launch plan with ORB channel strategy

4. product-description-generator
   ↓ "Creating SEO-optimized product descriptions"
   ↓ Output: Platform-specific descriptions (MD/HTML/CSV)

5. copywriting
   ↓ "Writing landing page copy and CTAs"
   ↓ Output: Copy brief + structured page copy

6. social-content
   ↓ "Planning 30-day social media campaign"
   ↓ Output: 30 social posts across 3 platforms
```

**Offer user scope options:**
> "This is a full product launch - expect 2-3 weeks. Should we:
> A) Complete workflow (all 6 steps)
> B) MVP launch (steps 1, 4, 5)
> C) Focus on one area first?"

---

## Scenario: Instagram Marketing Campaign

**Skills (4 steps):**

```
1. product-marketing-context (load existing or create)
   ↓

2. instagram-marketing (parallel with social-content)
   ↓ Input: Product URL, target audience, brand tone
   ↓ Output: IG content package (image brief, caption, 30 hashtags, posting strategy)
   ∥
   social-content
   ↓ Input: Objective, audience, brand voice
   ↓ Output: 7-day content calendar with platform-specific formatting

3. copywriting
   ↓ Refine captions with persuasive copy techniques
   ↓ Output: Polished captions with strong CTAs

4. social-media-publisher (or mcp-tools for cross-platform)
   ↓ Publish posts with images, hashtags, and user tags
```

**Platform-specific publishing:**
- Instagram/Twitter → `social-media-publisher`
- Twitter/LinkedIn/TikTok/Reddit → `mcp-tools`
- 小红书 → `xiaohongshu-explore` (agent skill)

---

## Scenario: Conversion Diagnosis

**"Why aren't my ads converting?" — Diagnostic workflow:**

```
1. page-cro
   ↓ Audit landing page conversion factors
   ↓ Input: Page URL, primary conversion goal, traffic context
   ↓ Output: Quick wins + high-impact changes + test hypotheses

2. ab-test-setup
   ↓ Design experiments to improve identified weak points
   ↓ Input: Test context, goal, baseline, traffic volume
   ↓ Output: Test plan with hypothesis, design, metrics

3. copywriting
   ↓ Apply quick wins: headline, CTA, trust signal copy improvements
   ↓ Input: Current page copy, identified weak points from page-cro
   ↓ Output: Revised copy with annotations
```

**Quick win checklist (apply immediately via copywriting):**
- Headline clarity — does it match the ad promise?
- CTA strength — is the action clear?
- Trust signals — reviews, guarantees, social proof?
- Page speed — above 3 seconds = lost conversions

---

## Scenario: China Market Entry

**Research-focused workflow:**

```
1. company-research (requires Exa API)
   ↓ Analyze Chinese competitors in the category
   ↓ Output: Company profiles, market gaps

2. competitive-landscape
   ↓ Map the competitive field using Five Forces + Blue Ocean
   ↓ Output: Scorecard, positioning map, pricing matrix

3. social-content (Chinese platforms focus)
   ↓ Strategy for 小红书, 抖音, 微信
   ↓ Output: Platform-specific content pillars and hook formulas
```

**Deliverables:**
- Competitor analysis matrix
- Go-to-market recommendations
- Chinese social media content strategy with platform-specific tactics

---

## End-to-End Launch Timeline

**4-6 week execution plan:**

### Week 1: Foundation
```
Day 1-2: product-marketing-context
  → Output: .claude/product-marketing-context.md

Day 3-4: company-research + competitive-landscape (parallel)
  → Output: Market opportunity report + competitor analysis
```

### Week 2: Strategy
```
Day 1-2: launch-strategy
  → Output: 5-phase launch plan

Day 3: marketing-ideas
  → Output: Selected 5-7 tactics for launch

Day 4-5: content-strategy
  → Output: 90-day content calendar
```

### Week 3-4: Content Creation (parallel execution)
```
product-description-generator
  → Amazon, Shopify, Etsy descriptions

copywriting
  → Landing page, email copy, ad copy

social-content
  → 30 social posts (3 platforms × 10 posts each)
```

### Week 5: Optimization & Launch
```
page-cro → Optimize landing page conversion elements
ab-test-setup → Configure A/B tests for headline, CTA, pricing

Launch day:
  - mcp-tools: Post launch announcements (Twitter/LinkedIn)
  - social-media-publisher: Launch IG campaign

Ongoing:
  - review-summarizer: Collect early testimonials
  - page-cro: Iterate based on data
  - social-content: Daily community engagement
```

---

## Quick Start Packs

### Beginner: "I'm new to marketing"

4-skill starter pack:

```
1. product-marketing-context (15 min setup)
   → Define positioning, brand voice, target audience

2. product-description-generator
   → Create product descriptions for your store

3. copywriting
   → Write homepage and key landing pages

4. social-content
   → Plan first 7 days of social posts
```

### Urgent: "I need to increase sales fast"

Conversion optimization sprint:

```
Step 1: Diagnostics (30 min)
  - page-cro: Audit landing page

Step 2: Quick Wins (1-2 days)
  - copywriting: Headline + CTA optimization
  - marketing-psychology: Apply urgency/social proof

Step 3: Testing (1 week)
  - ab-test-setup: Test 2-3 variations

Expected impact: 20-50% conversion lift
```

### Competitive: "How do I compete with bigger brands?"

```
1. competitive-landscape → Map the competitive field
2. company-research → Identify their weak points (requires Exa API)
3. people-research → Find underserved customer segments (requires Exa API)
4. marketing-ideas → Unconventional tactics big brands won't do

Then: content-strategy to build on identified strengths
```
