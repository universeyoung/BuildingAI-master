---
name: docx
description: "Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. Use when working with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks"
---

# DOCX creation, editing, and analysis

## Overview

A user may ask you to create, edit, or analyze the contents of a .docx file. A .docx file is essentially a ZIP archive containing XML files and other resources that you can read or edit. You have different tools and workflows available for different tasks.

## Setup — run this FIRST (mandatory, idempotent)

This skill ships with a pinned `package.json` for the required Node dep (`docx`).
**Before any docx-js workflow** (creating new Word documents), run the bootstrap script.

```bash
bash "{skillDir}/bootstrap.sh"
```

- Idempotent: first run installs (~5s); reruns finish in <100ms.
- Your own scripts run from a separate workspace dir — prefix `node` invocations with `export NODE_PATH="{skillDir}/node_modules"` so `require('docx')` resolves.

## Workflow Decision Tree

### Reading/Analyzing Content
Use "Text extraction" or "Raw XML access" sections below

### Creating New Document
Use "Creating a new Word document" workflow

### Editing Existing Document
- **Your own document + simple changes**
  Use "Basic OOXML editing" workflow

- **Someone else's document**
  Use **"Redlining workflow"** (recommended default)

- **Legal, academic, business, or government docs**
  Use **"Redlining workflow"** (required)

## Reading and analyzing content

### Text extraction
To read the text contents of a document, use **markitdown** (pure Python, no system deps). Preserves tables, headings, and bold/italic:

```bash
markitdown path-to-file.docx > output.md
```

Install if missing: `pip install 'markitdown[docx]'`. Note: markitdown auto-accepts tracked changes — if you need to see original vs revised text, use the **Redlining workflow** below.

### Raw XML access
You need raw XML access for: comments, complex formatting, document structure, embedded media, and metadata. For any of these features, you'll need to unpack a document and read its raw XML contents.

#### Unpacking a file
`python ooxml/scripts/unpack.py <office_file> <output_directory>`

#### Key file structures
* `word/document.xml` - Main document contents
* `word/comments.xml` - Comments referenced in document.xml
* `word/media/` - Embedded images and media files
* Tracked changes use `<w:ins>` (insertions) and `<w:del>` (deletions) tags

## Creating a new Word document

When creating a new Word document from scratch, use **docx-js**, which allows you to create Word documents using JavaScript/TypeScript.

### Workflow
1. **MANDATORY - READ ENTIRE FILE**: Read [`docx-js.md`](docx-js.md) (~500 lines) completely from start to finish. **NEVER set any range limits when reading this file.** Read the full file content for detailed syntax, critical formatting rules, and best practices before proceeding with document creation.
2. Ensure deps are installed by running `bash "{skillDir}/bootstrap.sh"` (see [Setup](#setup--run-this-first-mandatory-idempotent)).
3. Create a JavaScript/TypeScript file using Document, Paragraph, TextRun components.
4. Export as .docx using Packer.toBuffer(). When invoking your script from a workspace dir, prefix with `export NODE_PATH="{skillDir}/node_modules"` so `require('docx')` resolves.

## Editing an existing Word document

When editing an existing Word document, use the **Document library** (a Python library for OOXML manipulation). The library automatically handles infrastructure setup and provides methods for document manipulation. For complex scenarios, you can access the underlying DOM directly through the library.

### Workflow
1. **MANDATORY - READ ENTIRE FILE**: Read [`ooxml.md`](ooxml.md) (~600 lines) completely from start to finish. **NEVER set any range limits when reading this file.** Read the full file content for the Document library API and XML patterns for directly editing document files.
2. Unpack the document: `python ooxml/scripts/unpack.py <office_file> <output_directory>`
3. Create and run a Python script using the Document library (see "Document Library" section in ooxml.md)
4. Pack the final document: `python ooxml/scripts/pack.py <input_directory> <office_file>`

The Document library provides both high-level methods for common operations and direct DOM access for complex scenarios.

## Redlining workflow for document review

This workflow allows you to plan comprehensive tracked changes using markdown before implementing them in OOXML. **CRITICAL**: For complete tracked changes, you must implement ALL changes systematically.

**Batching Strategy**: Group related changes into batches of 3-10 changes. This makes debugging manageable while maintaining efficiency. Test each batch before moving to the next.

**Principle: Minimal, Precise Edits**
When implementing tracked changes, only mark text that actually changes. Repeating unchanged text makes edits harder to review and appears unprofessional. Break replacements into: [unchanged text] + [deletion] + [insertion] + [unchanged text]. Preserve the original run's RSID for unchanged text by extracting the `<w:r>` element from the original and reusing it.

Example - Changing "30 days" to "60 days" in a sentence:
```python
# BAD - Replaces entire sentence
'<w:del><w:r><w:delText>The term is 30 days.</w:delText></w:r></w:del><w:ins><w:r><w:t>The term is 60 days.</w:t></w:r></w:ins>'

# GOOD - Only marks what changed, preserves original <w:r> for unchanged text
'<w:r w:rsidR="00AB12CD"><w:t>The term is </w:t></w:r><w:del><w:r><w:delText>30</w:delText></w:r></w:del><w:ins><w:r><w:t>60</w:t></w:r></w:ins><w:r w:rsidR="00AB12CD"><w:t> days.</w:t></w:r>'
```

### Tracked changes workflow

1. **Get a representation that preserves tracked changes**: Redlining needs both original text and any pre-existing revisions.

   **Preferred — pandoc** (emits `[old]{.deletion} [new]{.insertion}` markers):
   ```bash
   pandoc --track-changes=all path-to-file.docx -o current.md
   ```

   **Fallback if pandoc is unavailable** — read raw XML:
   ```bash
   python ooxml/scripts/unpack.py path-to-file.docx unpacked/
   grep -nE '<w:(ins|del) ' unpacked/word/document.xml
   ```
   Insertions are in `<w:ins>`, deletions in `<w:del>` (text in `<w:delText>`); author/date in `w:author`/`w:date` attrs. Do **not** use markitdown/mammoth/python-docx here — they auto-accept or drop tracked changes.

2. **Identify and group changes**: Review the document and identify ALL changes needed, organizing them into logical batches:

   **Location methods** (for finding changes in XML):
   - Section/heading numbers (e.g., "Section 3.2", "Article IV")
   - Paragraph identifiers if numbered
   - Grep patterns with unique surrounding text
   - Document structure (e.g., "first paragraph", "signature block")
   - **DO NOT use markdown line numbers** - they don't map to XML structure

   **Batch organization** (group 3-10 related changes per batch):
   - By section: "Batch 1: Section 2 amendments", "Batch 2: Section 5 updates"
   - By type: "Batch 1: Date corrections", "Batch 2: Party name changes"
   - By complexity: Start with simple text replacements, then tackle complex structural changes
   - Sequential: "Batch 1: Pages 1-3", "Batch 2: Pages 4-6"

3. **Read documentation and unpack**:
   - **MANDATORY - READ ENTIRE FILE**: Read [`ooxml.md`](ooxml.md) (~600 lines) completely from start to finish. **NEVER set any range limits when reading this file.** Pay special attention to the "Document Library" and "Tracked Change Patterns" sections.
   - **Unpack the document**: `python ooxml/scripts/unpack.py <file.docx> <dir>`
   - **Note the suggested RSID**: The unpack script will suggest an RSID to use for your tracked changes. Copy this RSID for use in step 4b.

4. **Implement changes in batches**: Group changes logically (by section, by type, or by proximity) and implement them together in a single script. This approach:
   - Makes debugging easier (smaller batch = easier to isolate errors)
   - Allows incremental progress
   - Maintains efficiency (batch size of 3-10 changes works well)

   **Suggested batch groupings:**
   - By document section (e.g., "Section 3 changes", "Definitions", "Termination clause")
   - By change type (e.g., "Date changes", "Party name updates", "Legal term replacements")
   - By proximity (e.g., "Changes on pages 1-3", "Changes in first half of document")

   For each batch of related changes:

   **a. Map text to XML**: Grep for text in `word/document.xml` to verify how text is split across `<w:r>` elements.

   **b. Create and run script**: Use `get_node` to find nodes, implement changes, then `doc.save()`. See **"Document Library"** section in ooxml.md for patterns.

   **Note**: Always grep `word/document.xml` immediately before writing a script to get current line numbers and verify text content. Line numbers change after each script run.

5. **Pack the document**: After all batches are complete, convert the unpacked directory back to .docx:
   ```bash
   python ooxml/scripts/pack.py unpacked reviewed-document.docx
   ```

6. **Final verification**: Comprehensively check the result.

   **Preferred — pandoc**:
   ```bash
   pandoc --track-changes=all reviewed-document.docx -o verification.md
   grep "original phrase" verification.md     # Should NOT find it
   grep "replacement phrase" verification.md  # Should find it
   ```

   **Fallback if pandoc is unavailable** — verify against raw XML (do not use markitdown/mammoth, which auto-accept changes and mask bugs):
   ```bash
   python ooxml/scripts/unpack.py reviewed-document.docx verify_unpacked/
   grep "original phrase" verify_unpacked/word/document.xml     # Should NOT find it
   grep "replacement phrase" verify_unpacked/word/document.xml  # Should find it
   grep -cE '<w:(ins|del) ' verify_unpacked/word/document.xml   # Sanity-check markers
   ```

   Also check that no unintended changes were introduced.


## Converting Documents to Images

To visually analyze Word documents, convert them to images using a two-step process. Requires `soffice` (LibreOffice) and `pdftoppm` (Poppler).

**Install if missing**:
- macOS: `brew install --cask libreoffice && brew install poppler`
- Linux (Debian/Ubuntu): `sudo apt-get install libreoffice poppler-utils`
- Windows: `choco install libreoffice poppler`
(Use the fallback section if installation fails)

1. **Convert DOCX to PDF**:
   ```bash
   soffice --headless --convert-to pdf document.docx
   ```

2. **Convert PDF pages to JPEG images**:
   ```bash
   pdftoppm -jpeg -r 150 document.pdf page
   ```
   This creates files like `page-1.jpg`, `page-2.jpg`, etc.

Options:
- `-r 150`: Sets resolution to 150 DPI (adjust for quality/size balance)
- `-jpeg`: Output JPEG format (use `-png` for PNG if preferred)
- `-f N`: First page to convert (e.g., `-f 2` starts from page 2)
- `-l N`: Last page to convert (e.g., `-l 5` stops at page 5)
- `page`: Prefix for output files

Example for specific range:
```bash
pdftoppm -jpeg -r 150 -f 2 -l 5 document.pdf page  # Converts only pages 2-5
```

### Fallback when LibreOffice / Poppler installation fails

Only use these fallbacks after installation has been attempted and failed. DOCX is flow-layout, so without a renderer there is no true page screenshot — these are degraded substitutes, not equivalents. Pick by goal:

1. **Read textual content** (analysis, summarising, redlining): use markitdown (`markitdown document.docx > document.md`), which preserves headings, tables, and basic formatting.
2. **Inspect document structure** (heading levels, tables, styles): use `python-docx` to print an outline of `doc.paragraphs` (style + text) and `doc.tables` (rows × cols).
3. **Pixel-accurate visual review**: no pure-Python substitute exists. Report the install failure to the user and ask them to install LibreOffice + Poppler manually.

Do NOT fall back to manual "open in Word and screenshot" — it breaks the automated workflow.

## Code Style Guidelines
**IMPORTANT**: When generating code for DOCX operations:
- Write concise code
- Avoid verbose variable names and redundant operations
- Avoid unnecessary print statements

## Dependencies

**Node** (managed by `package.json`, installed by `bootstrap.sh` — see [Setup](#setup--run-this-first-mandatory-idempotent)):
- `docx` — docx-js document building (creating new documents)

**Python**:
- `pip install 'markitdown[docx]'` — text extraction
- `pip install defusedxml` — secure XML parsing

Optional (workflow-specific; skill stays usable when absent — see fallbacks in the relevant section):

- **pandoc** — Redlining workflow (`--track-changes=all`). `brew install pandoc` / `sudo apt-get install pandoc` / `choco install pandoc`. Fallback: unpack + grep `<w:(ins|del) '`.
- **LibreOffice** + **Poppler** — Converting Documents to Images. `brew install --cask libreoffice && brew install poppler` / `sudo apt-get install libreoffice poppler-utils` / `choco install libreoffice poppler`. Fallback: markitdown or python-docx.