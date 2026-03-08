-- ============================================================================
-- Phase 6: Sermon Preparation Parabola
-- ============================================================================

-- ─── Parabola Steps ─────────────────────────────────────────────────────────
create table public.sermon_parabola_steps (
  id          uuid primary key default gen_random_uuid(),
  step_number int not null unique check (step_number between 1 and 12),
  title       text not null,
  verdict     text not null check (verdict in ('allowed', 'caution', 'not_recommended')),
  why         text not null,
  boundaries  jsonb not null default '[]'::jsonb,
  prompts     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_sermon_parabola_steps_number on public.sermon_parabola_steps (step_number);

-- Allow all authenticated users to read steps
alter table public.sermon_parabola_steps enable row level security;
create policy "Anyone can read parabola steps"
  on public.sermon_parabola_steps for select
  using (true);

-- ─── Analytics: Step Clicks ─────────────────────────────────────────────────
create table public.sermon_parabola_clicks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  step_number int not null,
  created_at  timestamptz not null default now()
);

create index idx_parabola_clicks_user on public.sermon_parabola_clicks (user_id);
create index idx_parabola_clicks_step on public.sermon_parabola_clicks (step_number);

alter table public.sermon_parabola_clicks enable row level security;
create policy "Users can insert own clicks"
  on public.sermon_parabola_clicks for insert
  with check (auth.uid() = user_id);
create policy "Users can read own clicks"
  on public.sermon_parabola_clicks for select
  using (auth.uid() = user_id);

-- ─── Analytics: Prompt Copies ───────────────────────────────────────────────
create table public.sermon_parabola_prompt_copies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  step_number int not null,
  prompt_index int not null,
  created_at  timestamptz not null default now()
);

create index idx_parabola_copies_user on public.sermon_parabola_prompt_copies (user_id);
create index idx_parabola_copies_step on public.sermon_parabola_prompt_copies (step_number);

alter table public.sermon_parabola_prompt_copies enable row level security;
create policy "Users can insert own copies"
  on public.sermon_parabola_prompt_copies for insert
  with check (auth.uid() = user_id);
create policy "Users can read own copies"
  on public.sermon_parabola_prompt_copies for select
  using (auth.uid() = user_id);

-- ─── Seed Data ──────────────────────────────────────────────────────────────
insert into public.sermon_parabola_steps (step_number, title, verdict, why, boundaries, prompts) values

(1, 'Scripture', 'caution',
 'AI can help with navigation — cross-references, passage outlines, and word-study suggestions — but must never replace the preacher''s personal handling of the biblical text. Always verify AI outputs against the actual Scripture passage and trusted commentaries.',
 '["Always verify cross-references against a physical or digital Bible", "Request citations from AI — do not accept unsourced claims", "Use AI as a starting point, not the final authority on textual meaning", "Compare AI suggestions with at least one trusted commentary"]'::jsonb,
 '[
   {"text": "List 5 cross-references for [PASSAGE] from the KJV. For each, explain the thematic connection in one sentence and cite the verse text.", "id": "s1p1"},
   {"text": "Provide a structural outline of [PASSAGE] (KJV) showing the main divisions and sub-points. Note any literary devices present.", "id": "s1p2"},
   {"text": "What are the key Greek/Hebrew words in [PASSAGE]? For each, provide the original word, transliteration, Strong''s number, and a brief definition from a standard lexicon.", "id": "s1p3"},
   {"text": "Summarize the historical and cultural background of [PASSAGE] in 3–4 sentences. Cite specific sources (commentaries, encyclopedias) and note any areas of scholarly debate.", "id": "s1p4"},
   {"text": "Compare how [PASSAGE] is rendered in the KJV, NKJV, and ESV. Highlight any significant differences in wording and explain why they matter for interpretation.", "id": "s1p5"},
   {"text": "Identify the immediate literary context of [PASSAGE] — what comes before and after. How does the surrounding context shape the meaning of this passage?", "id": "s1p6"},
   {"text": "What are 3 common misinterpretations of [PASSAGE]? For each, explain why it is incorrect and provide the better reading with source citations.", "id": "s1p7"}
 ]'::jsonb),

(2, 'Soaking', 'not_recommended',
 'Soaking involves prayer, meditation, and spiritual sensitivity to the Holy Spirit. This is deeply personal spiritual formation that should not be outsourced to artificial intelligence. The preacher must sit with the text, pray through it, and listen for God''s voice. AI cannot replicate spiritual discernment, prophetic sensitivity, or the inner witness of the Spirit.',
 '["Do not use AI to simulate prayer or spiritual reflection", "Protect this step as sacred time between you and God", "Journal your impressions manually — do not ask AI to generate ''spiritual insights''", "If you feel stuck, seek counsel from a mentor or prayer partner, not a chatbot"]'::jsonb,
 '[]'::jsonb),

(3, 'Researching', 'caution',
 'AI can propose commentary sources, summarize scholarly positions, and surface relevant background material. However, AI frequently hallucinnates citations, invents book titles, and fabricates author quotes. Every source must be independently verified before use in sermon preparation.',
 '["Always ask AI to cite specific sources (author, title, page/chapter)", "Verify every citation independently — check that books and authors actually exist", "Request that AI note areas of uncertainty or scholarly disagreement", "Cross-check historical claims with at least two independent sources", "Prefer Protestant/Pentecostal-friendly commentaries and sources"]'::jsonb,
 '[
   {"text": "Recommend 5 Protestant/Pentecostal-friendly commentaries on [BOOK OF THE BIBLE]. For each, provide the author, full title, publisher, and a one-sentence summary of its approach.", "id": "s3p1"},
   {"text": "Summarize the key scholarly positions on the interpretation of [PASSAGE]. For each position, name the scholar(s) who hold it and cite their work. Note which position aligns best with Pentecostal theology.", "id": "s3p2"},
   {"text": "What are the major theological themes in [PASSAGE] according to evangelical scholarship? Provide citations for each theme.", "id": "s3p3"},
   {"text": "Provide background on the original audience of [BOOK]. What was their social, political, and religious context? Cite your sources and note any uncertainties.", "id": "s3p4"},
   {"text": "List 3–5 sermon illustrations or historical examples that relate to the themes in [PASSAGE]. For each, provide the source so I can verify it.", "id": "s3p5"},
   {"text": "What did [SPECIFIC THEOLOGIAN/COMMENTATOR] say about [PASSAGE]? Provide a direct quote with citation. If you are uncertain about the exact wording, say so.", "id": "s3p6"}
 ]'::jsonb),

(4, 'Summarising', 'allowed',
 'AI is effective at summarizing passage content, organizing observations, and distilling key themes into structured notes. This is a mechanical task well-suited to AI assistance. Always confirm the summary against the actual biblical text to ensure nothing is added, omitted, or distorted.',
 '["Compare AI summaries against the actual passage text", "Do not let AI add theological conclusions you have not reached yourself", "Use summaries as a starting point for your own synthesis"]'::jsonb,
 '[
   {"text": "Summarize [PASSAGE] (KJV) in 3–5 bullet points, capturing the main idea and supporting points. Do not add interpretation beyond what the text explicitly states.", "id": "s4p1"},
   {"text": "Create a verse-by-verse observation chart for [PASSAGE]. For each verse, list: (1) what it says, (2) key words, (3) questions it raises.", "id": "s4p2"},
   {"text": "Identify the main theological proposition of [PASSAGE] in one sentence. Then list the supporting arguments or illustrations the author uses.", "id": "s4p3"},
   {"text": "Distill [PASSAGE] into a single ''big idea'' statement suitable for a sermon. Provide 3 alternative phrasings.", "id": "s4p4"},
   {"text": "Compare my summary of [PASSAGE] with the text itself: [PASTE YOUR SUMMARY]. Does my summary accurately represent the passage? What have I missed or overstated?", "id": "s4p5"},
   {"text": "Organize the key observations from [PASSAGE] into categories: theological truths, commands/instructions, promises, warnings, and examples.", "id": "s4p6"}
 ]'::jsonb),

(5, 'Human Problem', 'caution',
 'AI can help brainstorm the human struggles, felt needs, and existential questions that a passage addresses. However, pastoral discernment — knowing what your specific congregation is facing — should not be flattened into generic AI-generated lists. Use AI suggestions as a starting point, then filter through your knowledge of your people.',
 '["Filter AI suggestions through your pastoral knowledge of your congregation", "Avoid using AI-generated problems that feel generic or disconnected from real life", "Do not let AI define the human condition — bring your own pastoral experience", "Use AI to broaden your thinking, not replace it"]'::jsonb,
 '[
   {"text": "Based on [PASSAGE], what are 5 human struggles or felt needs this text addresses? For each, explain the connection to the passage in one sentence.", "id": "s5p1"},
   {"text": "What questions might a modern Pentecostal congregation have when hearing [PASSAGE]? List 5 questions from different perspectives (new believer, mature Christian, skeptic, someone in crisis).", "id": "s5p2"},
   {"text": "Describe the emotional landscape of [PASSAGE]. What feelings does it evoke? What pastoral situations does it speak into?", "id": "s5p3"},
   {"text": "How does [PASSAGE] intersect with common struggles in [CONTEXT: e.g., urban ministry, young adults, families]? Provide 3 specific connections.", "id": "s5p4"},
   {"text": "What is the ''tension'' or ''conflict'' in [PASSAGE] that mirrors a real human experience? Frame it as a relatable scenario.", "id": "s5p5"}
 ]'::jsonb),

(6, 'Gospel Truth', 'caution',
 'AI can help connect passage themes to gospel doctrine and the broader redemptive narrative of Scripture. However, the preacher must ensure theological faithfulness — particularly that the gospel is not reduced, distorted, or stripped of its Pentecostal distinctives (the work of the Holy Spirit, transformation, power for living).',
 '["Ensure AI output aligns with orthodox Christian doctrine", "Check that the Holy Spirit''s role is not minimized or omitted", "Verify all doctrinal claims against Scripture", "Maintain Pentecostal theological distinctives where relevant", "Do not let AI flatten the gospel into generic moralism"]'::jsonb,
 '[
   {"text": "How does [PASSAGE] connect to the gospel of Jesus Christ? Trace the redemptive thread in 3–4 sentences, referencing specific verses.", "id": "s6p1"},
   {"text": "What role does the Holy Spirit play in the context of [PASSAGE]? How should a Pentecostal preacher emphasize this in a sermon?", "id": "s6p2"},
   {"text": "Identify the ''gospel movement'' in [PASSAGE]: from problem → to God''s provision → to transformed response. Frame each stage with verse references.", "id": "s6p3"},
   {"text": "How does [PASSAGE] relate to other key gospel passages (e.g., Romans 3:23-26, Ephesians 2:8-9, Acts 2:38)? Provide the connections with verse citations.", "id": "s6p4"},
   {"text": "What is the danger of preaching [PASSAGE] without the gospel? What does a ''moralistic'' reading look like vs. a ''gospel-centered'' reading? Give examples of both.", "id": "s6p5"},
   {"text": "Draft a gospel invitation paragraph that flows naturally from the themes of [PASSAGE]. Keep it theologically sound and pastorally warm.", "id": "s6p6"}
 ]'::jsonb),

(7, 'Relevance', 'allowed',
 'AI excels at generating modern examples, cultural connections, and application angles that make ancient texts feel immediate. This is a creative and organizational task where AI adds significant value. The preacher should still filter through pastoral wisdom and local context.',
 '["Keep examples authentic to your congregation''s experience", "Verify any factual claims in illustrations", "Use AI suggestions as raw material — personalize and adapt"]'::jsonb,
 '[
   {"text": "Generate 5 modern-day illustrations that connect to the themes of [PASSAGE]. Make them vivid, relatable, and suitable for a Pentecostal congregation.", "id": "s7p1"},
   {"text": "How would you explain the truth of [PASSAGE] to a 25-year-old who has never been to church? Use everyday language and concrete examples.", "id": "s7p2"},
   {"text": "What current events or cultural trends make [PASSAGE] especially relevant right now? List 3 connections with brief explanations.", "id": "s7p3"},
   {"text": "Create 3 application points from [PASSAGE] that move from understanding → feeling → action. Make them specific and actionable.", "id": "s7p4"},
   {"text": "How does [PASSAGE] speak to the following life situations: (1) someone facing job loss, (2) a new parent, (3) a teenager questioning faith? Write a brief application for each.", "id": "s7p5"},
   {"text": "Suggest 3 ''take-home challenges'' based on [PASSAGE] that congregation members could practice during the coming week.", "id": "s7p6"},
   {"text": "Write a brief analogy or metaphor that captures the central truth of [PASSAGE] in a way a child could understand.", "id": "s7p7"}
 ]'::jsonb),

(8, 'Structuring', 'allowed',
 'AI is strong at organizing content into clear outlines with logical flow, transitions, and groupings. The preacher chooses the final structure, but AI can offer multiple structural options to consider. This is one of the highest-value uses of AI in sermon prep.',
 '["Review multiple structure options before choosing one", "Ensure the structure serves the text, not the other way around", "The preacher makes the final structural decision"]'::jsonb,
 '[
   {"text": "Propose 3 different sermon outlines for [PASSAGE]. For each, provide: a title, 3–4 main points with sub-points, and a brief explanation of why this structure works.", "id": "s8p1"},
   {"text": "Create a 3-point sermon outline for [PASSAGE] that follows the movement of the text itself (expository structure). Include transitions between each point.", "id": "s8p2"},
   {"text": "Organize my sermon material into a narrative arc: Hook → Tension → Truth → Application → Response. Use the themes from [PASSAGE].", "id": "s8p3"},
   {"text": "I want to preach [PASSAGE] with the big idea: [YOUR BIG IDEA]. Suggest a sermon structure that supports this thesis. Include introduction and conclusion frameworks.", "id": "s8p4"},
   {"text": "Review this sermon outline and suggest improvements for flow, clarity, and engagement: [PASTE YOUR OUTLINE]. Note any logical gaps or missing transitions.", "id": "s8p5"},
   {"text": "Create an alliterative sermon outline for [PASSAGE] with 3 main points. Make the alliteration natural, not forced.", "id": "s8p6"},
   {"text": "Suggest effective transitions between these sermon points: [LIST YOUR POINTS]. Make them smooth and purposeful.", "id": "s8p7"}
 ]'::jsonb),

(9, 'Anticipated Response', 'allowed',
 'AI can help you think through how your congregation might respond — questions they may ask, objections they might raise, emotional reactions they might have. This helps you prepare pastorally. The pastor ultimately decides tone and pastoral care approach.',
 '["Use anticipated responses to prepare, not to manipulate", "Consider diverse audience members (new believers, skeptics, hurting people)", "The pastor decides pastoral tone and care approach"]'::jsonb,
 '[
   {"text": "What are 5 questions a congregation member might ask after hearing a sermon on [PASSAGE]? For each, draft a brief pastoral response.", "id": "s9p1"},
   {"text": "What emotional responses might [PASSAGE] trigger in listeners? Consider people in different life situations. How should the preacher prepare for each?", "id": "s9p2"},
   {"text": "What objections might a skeptic or doubter raise about the teaching in [PASSAGE]? List 3 objections with thoughtful, grace-filled responses.", "id": "s9p3"},
   {"text": "How might this sermon on [PASSAGE] land differently for: (1) a new believer, (2) someone backslidden, (3) a mature saint, (4) a visitor? Write a sentence for each.", "id": "s9p4"},
   {"text": "Draft an altar call / response invitation that is appropriate for a sermon on [PASSAGE]. Make it warm, clear, and non-manipulative.", "id": "s9p5"},
   {"text": "What follow-up resources or next steps could I offer after preaching [PASSAGE]? Suggest 3 practical options.", "id": "s9p6"}
 ]'::jsonb),

(10, 'Shaping Content', 'allowed',
 'AI can help tighten sermon sections, improve transitions, sharpen illustrations, and ensure clarity of communication. This is editing and refining work where AI adds significant value without replacing the preacher''s voice or message.',
 '["Maintain your authentic voice — do not let AI rewrite into generic ''preacher-speak''", "Use AI to tighten, not to replace your original material", "Review all AI suggestions against your intended meaning"]'::jsonb,
 '[
   {"text": "Review this sermon section and suggest ways to make it clearer and more concise without losing meaning: [PASTE SECTION].", "id": "s10p1"},
   {"text": "This illustration feels flat: [PASTE ILLUSTRATION]. Rewrite it to be more vivid and emotionally engaging while keeping the same point.", "id": "s10p2"},
   {"text": "Strengthen the transition between these two sermon points: [POINT A] and [POINT B]. Make it feel natural and purposeful.", "id": "s10p3"},
   {"text": "My sermon introduction is: [PASTE INTRO]. Does it effectively hook the listener and set up the message? Suggest improvements.", "id": "s10p4"},
   {"text": "My sermon conclusion is: [PASTE CONCLUSION]. Does it land with impact? Suggest a stronger closing that drives the main point home.", "id": "s10p5"},
   {"text": "Is there any redundancy in this sermon draft? Identify sections that repeat the same idea and suggest how to consolidate: [PASTE DRAFT].", "id": "s10p6"},
   {"text": "Rate the clarity of this sermon section on a scale of 1–10 and explain why. Then rewrite it at a 9 or 10 level: [PASTE SECTION].", "id": "s10p7"}
 ]'::jsonb),

(11, 'Writing & Polishing', 'allowed',
 'AI can help rewrite for clarity, fix grammar, improve cadence and rhythm, and polish prose. This is the most straightforward editorial use of AI. Be careful not to let AI ghostwrite personal testimony, vulnerable stories, or your unique pastoral voice.',
 '["Never let AI write personal testimonies or vulnerable stories for you", "Maintain your authentic preaching voice", "Use AI for polish, not for generating new content at this stage", "Read polished text aloud to ensure it sounds like YOU"]'::jsonb,
 '[
   {"text": "Proofread this sermon manuscript for grammar, spelling, and punctuation errors. Do not change the style or voice: [PASTE MANUSCRIPT].", "id": "s11p1"},
   {"text": "Rewrite this sermon section for better oral delivery — shorter sentences, natural rhythm, and clear emphasis points: [PASTE SECTION].", "id": "s11p2"},
   {"text": "Adjust the reading level of this section to be accessible to a general audience (8th-grade reading level) while maintaining theological depth: [PASTE SECTION].", "id": "s11p3"},
   {"text": "Add emphasis markers (bold, pause indicators, vocal cues) to this sermon manuscript to help with delivery: [PASTE MANUSCRIPT].", "id": "s11p4"},
   {"text": "Check this sermon for consistent tense, person, and tone. Flag any inconsistencies: [PASTE MANUSCRIPT].", "id": "s11p5"},
   {"text": "Suggest 3 alternative phrasings for this key sentence that might land better when spoken aloud: [PASTE SENTENCE].", "id": "s11p6"}
 ]'::jsonb),

(12, 'Preaching', 'not_recommended',
 'Delivery, spiritual leadership, and real-time discernment in the pulpit must be human-led. The act of preaching involves the anointing of the Holy Spirit, reading the room, responding to what God is doing in the moment, and personal pastoral authority. AI cannot replicate any of these. AI may have helped earlier in preparation, but it must not ''preach for you.''',
 '["AI cannot replace the anointing of the Holy Spirit in delivery", "Real-time spiritual sensitivity requires human presence", "Pastoral authority and authenticity cannot be outsourced", "If you rely on AI-generated scripts word-for-word, you risk losing your authentic voice", "Practice and rehearse, but deliver in the power of the Spirit"]'::jsonb,
 '[]'::jsonb);
