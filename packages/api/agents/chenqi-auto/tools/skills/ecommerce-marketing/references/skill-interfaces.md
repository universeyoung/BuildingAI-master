# Sub-Skill Interface Reference

Input/output specs for all 19 marketing sub-skills. Use this to prepare the right information before activating a skill.

## Table of Contents

1. [Research Skills](#research-skills) — company-research, competitive-landscape, people-research
2. [Strategy Skills](#strategy-skills) — product-marketing-context, launch-strategy, marketing-ideas, content-strategy
3. [Content Skills](#content-skills) — copywriting, product-description-generator, social-content, instagram-marketing, remotion
4. [Publishing Skills](#publishing-skills) — mcp-tools, social-media-publisher
5. [Optimization Skills](#optimization-skills) — page-cro, ab-test-setup
6. [Supporting Skills](#supporting-skills) — marketing-psychology, review-summarizer, social-network-mapper, sales-negotiator

---

## Research Skills

### company-research
- **Input**: Query (industry/company name), numResults, intent ("a few" vs "comprehensive")
- **Output**: Structured company list with sources and relevance scores, uncertainty notes
- **API**: Exa API (`EXA_API_KEY` env var) — **required**
- **Notes**: Use for competitor analysis, market gap identification. Supports both broad industry scans and specific company deep-dives.

### competitive-landscape
- **Input**: Target customer, statement of need, product category, key benefit, differentiator
- **Output**: Five Forces scorecard, Blue Ocean strategy canvas, positioning map, pricing matrix
- **API**: None
- **Notes**: Framework-driven analysis. Works without API. Pair with `company-research` for data-backed positioning.

### people-research
- **Input**: Query (role/name), numResults, intent
- **Output**: Results (name, title, company), profile URLs, verification status
- **API**: Exa API (`EXA_API_KEY`) — **required**
- **Notes**: For ICP/persona development. Can use Claude in Chrome for auth-gated content.

---

## Strategy Skills

### product-marketing-context ⭐ (Start Here)
- **Input**: Codebase (README, landing pages) for auto-draft, OR manual input for 12 sections
- **Output**: `./product-marketing-context.md` (or `.claude/product-marketing-context.md`)
- **API**: None
- **Notes**: **Run this first for any new product.** Creates the foundational context document referenced by all other marketing skills. One-time setup, ~15 min.

### launch-strategy
- **Input**: Product details, audience size, owned channels, timeline, launch history
- **Output**: Phased launch plan (Internal → Full), ORB channel strategy, Product Hunt plan
- **API**: None
- **Dependencies**: Recommends `marketing-ideas`, `page-cro`, `marketing-psychology`
- **Notes**: 5-phase launch framework. Best for new product introductions.

### marketing-ideas
- **Input**: Product, audience, current stage, resources (budget/team size)
- **Output**: 3-5 relevant ideas with fit rationale, starting steps, expected outcome, required resources
- **API**: None
- **Dependencies**: References `page-cro`, `ab-test-setup`
- **Notes**: Library of 140 proven SaaS marketing strategies. Filters by business context.

### content-strategy
- **Input**: Business context, customer research, current resources, competitive landscape
- **Output**: 3-5 content pillars, priority topics (searchable/shareable), topic cluster map
- **API**: None
- **Dependencies**: References `product-marketing-context`, `copywriting`, `social-content`
- **Notes**: Long-term editorial calendar planning. Maps topics to buyer's journey.

---

## Content Skills

### copywriting
- **Input**: Page type, primary CTA, audience problem, differentiator, awareness level
- **Output**: Copy brief, structured page copy, headline/CTA alternatives, annotations
- **API**: None
- **Notes**: Universal marketing copy for pages, ads, emails, CTAs. Enforces clarity over hype.

### product-description-generator
- **Input**: Product name, platform (Amazon/Shopify/eBay/Etsy), features, benefits, tone, audience, keywords
- **Output**: SEO-optimized descriptions (MD/HTML/CSV), meta data, A/B variations
- **API**: None
- **Scripts**: `generate_description.py`, `bulk_generate.py`, `optimize_description.py`
- **Notes**: Supports bulk generation. Platform-specific formatting.

### social-content
- **Input**: Objective, target action, audience details, brand voice, available resources
- **Output**: Social posts for 8 platforms (LinkedIn, X, IG, TikTok, FB, YouTube, Reddit, Pinterest), content pillars, hook formulas, calendar
- **API**: None
- **Dependencies**: References `copywriting`, `launch-strategy`, `marketing-psychology`
- **Notes**: Platform-specific formatting and best practices. Includes repurposing strategies.

### instagram-marketing
- **Input**: Product URL, target audience, brand tone
- **Output**: IG content package — image brief, caption, 30 hashtags, posting strategy
- **API**: None
- **Scripts**: `extract_product.py`, framework/template references
- **Notes**: Transforms product URLs into IG-native content. Uses aesthetic frameworks.

### remotion
- **Input**: React code, assets (images/audio), parameters schema
- **Output**: Programmatic video compositions
- **API**: None (but requires React, FFmpeg locally)
- **Notes**: For product walkthrough videos and demos. Heavy local dependency.

---

## Publishing Skills

### mcp-tools
- **Input**: `accio-mcp-cli search` / `accio-mcp-cli toolkit` / `accio-mcp-cli call` with tool name and arguments
- **Output**: Results from 100+ remote services
- **API**: accio-mcp-cli → MCP gateway — varies by platform
- **Platforms**: Twitter/X, LinkedIn, TikTok, Reddit, Google Workspace, Notion, GitHub
- **Notes**: Gateway via CLI. Use `accio-mcp-cli search twitter` (alias: `keyword`) or `accio-mcp-cli toolkit` to discover tools, then `accio-mcp-cli call <tool-name> ...`.

### social-media-publisher
- **Input**: Platform (Instagram/Twitter), content (text, images), hashtags, user tags
- **Output**: Published post confirmation
- **API**: Platform-specific OAuth
- **Platforms**: Instagram, Twitter/X
- **Notes**: Handles image posts, text posts, hashtags, user tags, multi-platform publishing.

---

## Optimization Skills

### page-cro
- **Input**: Page type, primary conversion goal, traffic context, user research data
- **Output**: Quick wins, high-impact changes, test hypotheses, copy alternatives
- **API**: None
- **Dependencies**: References `copywriting`, `ab-test-setup`
- **Notes**: Focuses on clarity, headline effectiveness, hierarchy, friction reduction.

### ab-test-setup
- **Input**: Test context, goal, current baseline, traffic volume, constraints
- **Output**: Test plan (hypothesis, design, metrics), results summary, recommendations
- **API**: None
- **Dependencies**: References `page-cro`, `copywriting`
- **Notes**: Statistical validity guidance. Sample size calculations.

---

## Supporting Skills

### marketing-psychology
- **Input**: Marketing challenge (e.g., low conversion), behavior to influence
- **Output**: Relevant mental models (from 70+ library), applications, ethical implementation tips
- **API**: None
- **Notes**: Pair with `copywriting`, `page-cro`, or `ab-test-setup` for applied persuasion.

### review-summarizer
- **Input**: Product/business URL, platform, review limit, filters (verified/rating)
- **Output**: Review summary (MD/JSON), sentiment score, pros/cons, FAQ, recommendation
- **API**: None
- **Scripts**: `scrape_reviews.py`, `compare_reviews.py`, `sentiment_analysis.py`
- **Notes**: Scrapes Amazon, Google, Yelp reviews. Extract customer voice for marketing.

### social-network-mapper
- **Input**: Seed list (names, Twitter handles, GitHub usernames)
- **Output**: Social graph (nodes/edges), cluster summaries, centrality report, visualization
- **API**: Twitter API via MCP (AIsa)
- **Notes**: Maps relationships and communities. Useful for influencer identification.

### sales-negotiator
- **Input**: Deal context (B2B), stakeholder map, pricing/discount requests
- **Output**: Negotiation strategy, BATNA hierarchy, value trades, concession patterns
- **API**: None
- **Notes**: B2B only. Covers anchoring, stakeholder power mapping, procurement handling.
