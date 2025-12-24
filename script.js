document.addEventListener("DOMContentLoaded", () => {

  // ============= DOM REFERENCES =============
  const pdfUpload = document.getElementById("pdfUpload");
  const dictionaryModeSelect = document.getElementById("dictionaryMode");
  const toggleScientific = document.getElementById("toggleScientific");
  const toggleSimpleEnglish = document.getElementById("toggleSimpleEnglish");

  const statusMessageEl = document.getElementById("statusMessage");
  const articleTitleEl = document.getElementById("articleTitle");
  const articleMetaEl = document.getElementById("articleMeta");
  const articleContentEl = document.getElementById("articleContent");

  const tooltipEl = document.getElementById("tooltip");
  const tooltipTermEl = document.getElementById("tooltipTerm");
  const tooltipSourceEl = document.getElementById("tooltipSource");
  const tooltipDefinitionEl = document.getElementById("tooltipDefinition");

  // ============= STATUS =============
  function setStatus(msg, type = "info") {
    statusMessageEl.textContent = msg;
    statusMessageEl.style.color =
      type === "error" ? "#b00020" :
      type === "success" ? "#2e7d32" :
      "#333";
  }

  // ============= SCIENTIFIC DICTIONARIES =============
  const dictMicro = {
    pathogen: "A microorganism that can cause disease.",
    virulence: "The degree of pathogenicity of a microorganism.",
    biofilm: "A structured community of microorganisms within a matrix."
  };

  const dictGenetics = {
    genome: "The complete set of DNA in an organism.",
    allele: "One of two or more versions of a gene.",
    mutation: "A permanent change in DNA sequence."
  };

  const dictImmunology = {
    antigen: "A molecule recognized by the immune system.",
    antibody: "A protein produced by B cells that binds antigens.",
    cytokine: "A signaling protein in the immune system."
  };

  const dictBiology = {
    homeostasis: "Maintenance of internal stability.",
    metabolism: "Chemical processes that maintain life.",
    osmosis: "Diffusion of water across a membrane."
  };

  const dictChemistry = {
    molarity: "Concentration expressed as moles per liter.",
    catalyst: "A substance that speeds up a reaction.",
    polymer: "A molecule made of repeating units."
  };

  const dictCombined = {
    ...dictMicro,
    ...dictGenetics,
    ...dictImmunology,
    ...dictBiology,
    ...dictChemistry
  };

  const SCI_DICTIONARIES = {
    micro: dictMicro,
    genetics: dictGenetics,
    immunology: dictImmunology,
    biology: dictBiology,
    chemistry: dictChemistry,
    combined: dictCombined
  };

  // ============= SIMPLE ENGLISH CACHE =============
  const englishDefinitionCache = new Map();
  const DICT_ENDPOINT = "https://api.dictionaryapi.dev/api/v2/entries/en/";

  // ============= PDF UPLOAD HANDLER =============
  pdfUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus("Reading PDF…");
    articleTitleEl.textContent = file.name;
    articleMetaEl.textContent = "";

    try {
      const text = await extractTextFromPDF(file);
      setStatus("Extracting and annotating text…");

      const processed = await annotateArticleText(text);
      articleContentEl.innerHTML = processed;

      setStatus("PDF processed successfully.", "success");
    } catch (err) {
      console.error(err);
      setStatus("Failed to extract text from PDF.", "error");
    }
  });

  // ============= PDF.js TEXT EXTRACTION =============
  async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(" ") + "\n";
    }

    return fullText;
  }

  // ============= ANNOTATION PIPELINE =============
  const COMMON_WORDS = new Set([
    "the","a","an","and","or","but","if","then","than","when","while","of","in",
    "on","for","to","from","by","with","at","as","is","are","was","were","be",
    "been","being","this","that","these","those","it","its","they","them","their",
    "he","she","his","her","we","us","our","you","your","i","me","my",
    "can","could","will","would","shall","should","may","might","do","does","did",
    "have","has","had","not","no","yes","so","such","just","very","more","most",
    "some","any","all","many","few","much","there","here","also","only","over",
    "into","out","up","down","about","through","between","within","without",
    "new","high","low","large","small","big","little","long","short","old","young",
    "use","make","made","say","says","said","show","shows","shown","get","got"
  ]);

  async function annotateArticleText(text) {
    const tokens = text.split(/(\s+|[,.!?;:()"'[\]{}])/);

    const dictMode = dictionaryModeSelect.value;
    const sciDict = SCI_DICTIONARIES[dictMode];
    const sciKeys = new Set(Object.keys(sciDict).map(k => k.toLowerCase()));

    const annotated = [];

    for (const token of tokens) {
      if (/^\s+$/.test(token) || /^[,.;:!?()"'[\]{}]$/.test(token)) {
        annotated.push(token);
        continue;
      }

      const raw = token;
      const norm = normalizeWord(raw);
      if (!norm) {
        annotated.push(raw);
        continue;
      }

      if (toggleScientific.checked && sciKeys.has(norm)) {
        annotated.push(createSciTermSpan(raw, norm, sciDict[norm], dictMode));
        continue;
      }

      if (COMMON_WORDS.has(norm) || looksLikeName(raw)) {
        annotated.push(raw);
        continue;
      }

      if (toggleSimpleEnglish.checked) {
        const defObj = await getSimpleEnglishDefinition(norm);
        if (defObj?.definition) {
          annotated.push(createSimpleTermSpan(raw, norm));
          continue;
        }
      }

      annotated.push(raw);
    }

    return annotated.join("");
  }

  function normalizeWord(word) {
    return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
  }

  function looksLikeName(raw) {
    if (/[.@]/.test(raw)) return false;
    return /^[A-Z][a-z]+$/.test(raw);
  }

  function createSciTermSpan(raw, norm, def, mode) {
    return `<span class="sci-term" data-term="${norm}" data-definition="${escapeHtml(def)}" data-source="${mode}">${escapeHtml(raw)}</span>`;
  }

  function createSimpleTermSpan(raw, norm) {
    return `<span class="simple-term" data-term="${norm}">${escapeHtml(raw)}</span>`;
  }

  async function getSimpleEnglishDefinition(word) {
    const w = word.toLowerCase();
    if (englishDefinitionCache.has(w)) return englishDefinitionCache.get(w);

    try {
      const res = await fetch(DICT_ENDPOINT + w);
      if (!res.ok) {
        englishDefinitionCache.set(w, { definition: null });
        return englishDefinitionCache.get(w);
      }
      const data = await res.json();
      const def = extractFirstDefinition(data);
      englishDefinitionCache.set(w, { definition: def });
      return englishDefinitionCache.get(w);
    } catch {
      englishDefinitionCache.set(w, { definition: null });
      return englishDefinitionCache.get(w);
    }
  }

  function extractFirstDefinition(apiResponse) {
    if (!Array.isArray(apiResponse)) return null;
    const entry = apiResponse[0];
    const meaning = entry?.meanings?.[0];
    return meaning?.definitions?.[0]?.definition || null;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ============= TOOLTIP =============
  articleContentEl.addEventListener("click", (e) => {
    const target = e.target;

    if (target.classList.contains("simple-term")) {
      const word = target.dataset.term;
      const defObj = englishDefinitionCache.get(word.toLowerCase());

      if (defObj?.definition) {
        showTooltip(
          word,
          defObj.definition,
          "Simple English dictionary",
          e.clientX,
          e.clientY
        );
      }
      return;
    }

    if (target.classList.contains("sci-term")) {
      showTooltip(
        target.dataset.term,
        target.dataset.definition,
        target.dataset.source,
        e.clientX,
        e.clientY
      );
      return;
    }

    hideTooltip();
  });

  function showTooltip(term, definition, source, x, y) {
    tooltipTermEl.textContent = term;
    tooltipSourceEl.textContent = source;
    tooltipDefinitionEl.textContent = definition;
    tooltipEl.classList.remove("hidden");

    let left = x + 10;
    let top = y + 10;

    const rect = tooltipEl.getBoundingClientRect();

    if (left + rect.width > window.innerWidth) {
      left = window.innerWidth - rect.width - 10;
    }
    if (top + rect.height > window.innerHeight) {
      top = window.innerHeight - rect.height - 10;
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function hideTooltip() {
    tooltipEl.classList.add("hidden");
  }

});
