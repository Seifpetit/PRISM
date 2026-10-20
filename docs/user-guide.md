# User guide

How PRISM works day to day, from a product to a campaign, its ads and their production. Back to the [README](../README.md).

## Building a campaign

On a product's Strategy canvas, press **+ New campaign** at the top right. The product node shows a badge for each
kind of campaign the product has (Test, Scaling or Retargeting).

1. **New campaign** opens the **campaign composer**, on a *test* campaign. Its type can be changed there to
   *scaling* or *retargeting*, which are labels for now and use the same ad set builder.
2. **Compose.** Tick personas, angles and offers, in that testing order: angle first, then offer, then persona.
   Every combination you tick becomes an ad set (up to 24 at a time), and the composer says how many. What the
   campaign *tests* (angle, offer or persona) sets the defaults and the guidance, and never blocks anything: keep
   the angles and change the offer and persona if you like, and the composer says the test is no longer clean and
   the ad sets are flagged as off-test. A progress bar (angle, offer, persona) stays pinned at the top of the
   drawer, and the button turns on once all three have a selection. Nothing exists until **Create campaign**, and
   then the campaign and all its ad sets are created together. Once a campaign exists, each campaign is a page of
   the canvas (tabs at the top right), and **+ New ad set** adds to the open page with the same composer; ticks
   the campaign already has are marked, and combinations it already has are skipped. If the product has no angles
   or offers yet, the composer offers to generate them.
3. Each ad set appears on the canvas as the joint of its persona, angle and offer, with an edge from each flowing
   into it. There is no separate campaign node. Click an ad set to open its drawer: the fixed concept, then its
   **creative plan**, then a collapsed *Execution & tracking* section for dates and spend. **Campaign details** in
   the drawer opens the campaign's quality check and **Export CSV**.
4. **Plan the ads.** Press **Generate ads**, choose what to optimise for (a format to fix such as an AI talking head, VSLs, how many ads, one ad per awareness stage, or a note) and the AI proposes ads for that one ad set, or add an
   ad by hand. Each ad has six dimensions: awareness stage, direction, format, hook, bridge (beats) and a call to
   action. The persona, angle and offer never change inside an ad set. The ad-set card on the canvas shows a line
   like "3 ads · 1 static ad, 2 video". **Open in Creatives** (or the **Creatives** tab) opens the
   Creatives workspace: every ad set is a track with its own colour and reference (AS-01, AS-02, ...), its ads are
   cards in the track's tray, and selecting a card opens that ad in a drawer to develop it. The concept is read-only there.

Ads are plans, not finished assets: producing scripts, visuals and platform versions comes after.
Personas are generated automatically when a product is created.

## The production pipeline

The **Pipeline** page (where Experiments used to be) tracks the work of turning ads into finished creative. Open an ad
in **Creatives** and press **Send to Pipeline** (the wide button at the top of the ad's drawer). That does not move or
copy the ad: it creates a **production task** linked to the same ad, in **Planned**. The ad's card in Creatives then
carries a small badge with the stage of its furthest task (and "+2" if it has more), and clicking the badge opens that
task on the board.

One board serves every format, with eight stages: **Planned**, **Script / Brief**, **Approved for production**, **In
production**, **In editing**, **In review**, **Ready to launch** and **Launched**. "Script / Brief" is one stage for all
formats, because a static ad needs a design brief, not a script. Drag a card between columns (or use the **Stage**
selector in its drawer) to move it.

What differs by format is the checklist inside the card: UGC video (script, creator assigned, footage received, edit,
captions), video (script/storyboard, footage/assets, edit, sound and captions), static ad (design brief, visual and copy,
design, export) and carousel (card-by-card outline, designs, sequence review, export), with similar ones for photo, AI
talking head and motion graphic. Every task also ends with "Primary text and headline" and "CTA and destination". Steps
can be added and removed. A task also holds notes, a name for its version, and the live Meta ad once launched (typed in;
it is not linked to Meta yet).

An ad can be sent more than once, for a different aspect ratio, a translation, and so on: **Send another version to
Pipeline** asks for a name, and each version is its own task that moves on its own. Deleting an ad does not delete its
tasks; they stay on the board marked "Ad removed", with a copy of what the ad was.

## Generation Setup and the Context Library

The generation buttons for **Target Avatars**, **Angles** and **Offers** each have a settings drawer (the
inspector icon next to the button). It is called **Generation Setup** and has two pages, switched by the small tabs
under its title. The ads have the same drawer (**Prompt** on the Creatives page), with a switch in its header between
**Creative plan** (Generate ads) and **Hook alternatives**; ads are generated per ad set and per ad, so that drawer
has no Generate button and its selection is used whenever you press Generate ads or ask for hook alternatives.

- **Template** (page one): the saved generation prompt, exactly as before: edit it and press *Save for next
  runs*. This is *what PRISM should do*. It replaces only the system prompt; the task, the confirmed Product
  Context, the output rules and the output schema are built in code, so an edited template cannot switch off
  validation.
- **Context** (page two): *what PRISM should know* and *what to focus on this time*.
  - The **confirmed Product Context** is always sent and is where product facts come from.
  - The product's **Context Library** holds reusable market material: customer interviews, sales-objection CSVs, a
    market-research PDF, or your own notes. Add a source once (**Add source**), then tick it in whichever
    generators should use it. Ticks are remembered per product and per generator, and nothing that is not ticked is
    ever sent. **Manage library** lets you read a source's stored text, rename it, edit a note or delete it.
  - **Instructions for this run** is an optional text box that applies to the next generation only and then clears.
    It steers focus (for example "Focus on apartment households in Madrid and Seville"); it cannot change product facts.
- **Preview context** (footer, both pages) shows what the next run will send: each selected source as it will be cut
  to fit, which pages, sections or rows were kept, and the rules that travel with it. It is built by the server the
  same way a real run is built. **Generate** is in the footer of both pages.

What can be added: **PDF** (needs a text layer; scans are refused with that reason), **TXT**, **Markdown** and
**CSV** (comma, semicolon or tab separated), plus written notes. Each is read when it is added and the text is stored
in the database; the original file is not kept. A file that can't be read is listed as *failed* with the reason and
can't be selected. Sources are limited to 10 MB (PDF) or 5 MB (text, CSV), 30 per product, 8 per generation.

How it reaches the model: the request names sources by id only; the server checks each one belongs to that product
and is ready, reads its stored text, and fits the selection into 24,000 characters. A source that fits goes in whole.
A longer PDF or text is cut to whole pages or sections that share the most words with the run (its instructions, the
product, and what the generator looks for), and a CSV goes in as its header, a profile of each column and up to 60 rows
spread evenly through the file, with row numbers. Every cut is reported. This is plain word matching, not search by
meaning. The text goes in a `marketEvidence` block marked as data, with rules (kept in code) that it never counts as
instructions, that product facts come only from the Product Context, and that a competitor's claim never becomes a claim
about your product. With nothing selected the request is byte for byte what it was before.

Each finished generation records its generator, the template version, the sources and their versions, the run
instructions and the time (`generation_context_runs`, readable through the `generationProvenance` query).
