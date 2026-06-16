// Conversor docx -> corpo LaTeX abnTeX2.
// Roda 100% no navegador. mammoth extrai o conteudo do .docx como HTML;
// aqui caminhamos pelo HTML e emitimos os comandos LaTeX correspondentes.
// A parte "inteligente" (referencias NBR 6023, citacoes NBR 10520, casos ambiguos)
// fica pro ChatGPT da usuaria via o prompt de handoff.

import mammoth from "mammoth";

// ---------------------------------------------------------------------------
// Escape de caracteres especiais do LaTeX. Sem isso, um "%" ou "&" solto
// quebra a compilacao inteira. Passada unica via mapa -> sem armadilha de ordem.
// ---------------------------------------------------------------------------
const ESCAPE_MAP = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "#": "\\#",
  $: "\\$",
  "%": "\\%",
  "&": "\\&",
  _: "\\_",
  "^": "\\textasciicircum{}",
  "~": "\\textasciitilde{}",
};

export function escapeLatex(s) {
  if (s == null) return "";
  return String(s).replace(/[\\{}#$%&_^~]/g, (c) => ESCAPE_MAP[c]);
}

// Palavras-chave de secoes pre/pos-textuais que NAO sao numeradas em ABNT.
const NAO_NUMERADAS = [
  "RESUMO",
  "ABSTRACT",
  "SUMARIO",
  "AGRADECIMENTOS",
  "DEDICATORIA",
  "EPIGRAFE",
  "LISTA DE FIGURAS",
  "LISTA DE TABELAS",
  "LISTA DE ABREVIATURAS",
];

function normaliza(t) {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toUpperCase()
    .trim();
}

function ehReferencias(texto) {
  return /^REFERENCIAS?\b/.test(normaliza(texto));
}

// Detecta se um <p> "comum" e na verdade um titulo (aluno nao usou Estilo do Word).
// Retorna { nivel, numerado, titulo } ou null.
function detectaTitulo(texto) {
  const t = texto.trim();
  if (!t || t.length > 120) return null;

  // 1) Numeracao progressiva: "1", "2.1", "3.1.2 ..." -> nivel = qtd de grupos.
  const mNum = t.match(/^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/);
  if (mNum) {
    const nivel = mNum[1].split(".").length;
    const titulo = mNum[2].trim();
    if (titulo && !/[.;:]$/.test(titulo)) {
      return { nivel: Math.min(nivel, 4), numerado: true, titulo };
    }
  }

  // 2) Linha curta em CAIXA ALTA, sem pontuacao final -> titulo primario.
  const temLetra = /[A-ZÀ-Ý]/.test(t);
  if (temLetra && t === t.toUpperCase() && !/[.;:]$/.test(t) && t.length <= 80) {
    return { nivel: 1, numerado: true, titulo: t };
  }

  return null;
}

const CMD_POR_NIVEL = [
  "\\chapter", // 1
  "\\section", // 2
  "\\subsection", // 3
  "\\subsubsection", // 4
];

function comandoTitulo(nivel, numerado) {
  const base = CMD_POR_NIVEL[Math.min(nivel, 4) - 1] || "\\subsubsection";
  return numerado ? base : base + "*";
}

// ---------------------------------------------------------------------------
// Inline: percorre nos de texto e formatacao dentro de um bloco.
// ---------------------------------------------------------------------------
function inlineParaLatex(node) {
  let out = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) {
      out += escapeLatex(n.textContent);
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    const inner = inlineParaLatex(n);
    switch (tag) {
      case "strong":
      case "b":
        out += `\\textbf{${inner}}`;
        break;
      case "em":
      case "i":
        out += `\\textit{${inner}}`;
        break;
      case "u":
        out += `\\underline{${inner}}`;
        break;
      case "sup":
        out += `\\textsuperscript{${inner}}`;
        break;
      case "sub":
        out += `\\textsubscript{${inner}}`;
        break;
      case "br":
        out += " \\\\\n";
        break;
      case "img":
        break; // imagens tratadas no nivel de bloco
      default:
        out += inner;
    }
  });
  return out;
}

function figuraParaLatex(img) {
  const src = img.getAttribute("src") || "";
  const alt = img.getAttribute("alt") || "";
  const legenda = alt ? escapeLatex(alt) : "Insira a legenda";
  return [
    "\\begin{figure}[htb]",
    "\\centering",
    `\\caption{${legenda}}`,
    `\\includegraphics[width=0.8\\textwidth]{${src}}`,
    "\\legend{Fonte: Insira a fonte.} % TODO: ajuste a fonte conforme ABNT",
    "\\end{figure}",
    "",
  ].join("\n");
}

function tabelaParaLatex(table) {
  const linhas = Array.from(table.querySelectorAll("tr"));
  if (!linhas.length) return "";
  const nCols = Math.max(
    ...linhas.map((tr) => tr.querySelectorAll("td,th").length)
  );
  const colSpec = "l".repeat(nCols);
  const corpo = linhas
    .map((tr) => {
      const cels = Array.from(tr.querySelectorAll("td,th")).map((c) =>
        inlineParaLatex(c).trim()
      );
      while (cels.length < nCols) cels.push("");
      return cels.join(" & ") + " \\\\";
    })
    .join("\n\\hline\n");
  return [
    "\\begin{table}[htb]",
    "\\centering",
    "\\caption{Insira o título da tabela}",
    `\\begin{tabular}{${colSpec}}`,
    "\\hline",
    corpo,
    "\\hline",
    "\\end{tabular}",
    "\\legend{Fonte: Insira a fonte.}",
    "\\end{table}",
    "",
  ].join("\n");
}

function emiteReferenciasHeader(saida) {
  saida.push("\\postextual");
  saida.push("\\chapter*{REFERÊNCIAS}");
  saida.push("\\addcontentsline{toc}{chapter}{REFERÊNCIAS}\n");
}

// ---------------------------------------------------------------------------
// Conversao principal de um arrayBuffer (.docx) -> { corpo, imagens, avisos }
// ---------------------------------------------------------------------------
export async function converterDocx(arrayBuffer) {
  const imagens = [];

  const options = {
    convertImage: mammoth.images.imgElement(async (image) => {
      const ext = (image.contentType || "image/png").split("/")[1] || "png";
      const nome = `figura${imagens.length + 1}.${ext.replace("jpeg", "jpg")}`;
      const base64 = await image.read("base64");
      imagens.push({ nome, base64 });
      return { src: `imagens/${nome}`, alt: image.altText || "" };
    }),
  };

  // No navegador recebemos um ArrayBuffer; em testes (Node) aceitamos
  // tambem um descritor de input do mammoth ({ buffer } / { path }).
  const input =
    arrayBuffer instanceof ArrayBuffer ? { arrayBuffer } : arrayBuffer;
  const { value: html, messages } = await mammoth.convertToHtml(input, options);

  const doc = new DOMParser().parseFromString(
    `<body>${html}</body>`,
    "text/html"
  );

  const saida = [];
  let modoReferencias = false;
  let temTabelas = false;

  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const nivel = parseInt(tag[1], 10);
      if (ehReferencias(el.textContent)) {
        modoReferencias = true;
        emiteReferenciasHeader(saida);
        continue;
      }
      const titulo = inlineParaLatex(el).trim();
      const naoNumerada = NAO_NUMERADAS.includes(normaliza(el.textContent));
      saida.push(`${comandoTitulo(nivel, !naoNumerada)}{${titulo}}\n`);
      continue;
    }

    if (tag === "p") {
      const texto = el.textContent.trim();
      if (!texto) continue;

      if (ehReferencias(texto) && texto.length < 40) {
        modoReferencias = true;
        emiteReferenciasHeader(saida);
        continue;
      }

      const imgs = el.querySelectorAll("img");
      if (imgs.length) {
        imgs.forEach((img) => saida.push(figuraParaLatex(img)));
        if (!el.textContent.trim()) continue;
      }

      if (modoReferencias) {
        saida.push(`\\noindent ${inlineParaLatex(el)}\\par\\bigskip`);
        continue;
      }

      const det = detectaTitulo(texto);
      if (det) {
        const naoNum = NAO_NUMERADAS.includes(normaliza(det.titulo));
        saida.push(
          `${comandoTitulo(det.nivel, det.numerado && !naoNum)}{${escapeLatex(
            det.titulo
          )}}\n`
        );
        continue;
      }

      saida.push(inlineParaLatex(el) + "\n");
      continue;
    }

    if (tag === "blockquote") {
      saida.push("\\begin{citacao}");
      saida.push(inlineParaLatex(el).trim());
      saida.push("\\end{citacao}\n");
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      const env = tag === "ul" ? "itemize" : "enumerate";
      saida.push(`\\begin{${env}}`);
      el.querySelectorAll(":scope > li").forEach((li) => {
        saida.push(`  \\item ${inlineParaLatex(li).trim()}`);
      });
      saida.push(`\\end{${env}}\n`);
      continue;
    }

    if (tag === "table") {
      temTabelas = true;
      saida.push(tabelaParaLatex(el));
      continue;
    }

    const t = inlineParaLatex(el).trim();
    if (t) saida.push(t + "\n");
  }

  return {
    corpo: saida.join("\n"),
    imagens,
    temTabelas,
    avisos: messages || [],
  };
}
