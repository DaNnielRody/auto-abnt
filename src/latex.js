// Monta o documento abnTeX2 completo a partir dos metadados do formulario
// (capa + folha de rosto + resumo + sumario) e do corpo convertido do .docx.

import { escapeLatex } from "./converter.js";

function preambuloSubmissao(meta) {
  // Texto da folha de rosto (natureza do trabalho). O ChatGPT ajusta o grau/tipo.
  const curso = escapeLatex(meta.curso || "[curso]");
  const inst = escapeLatex(meta.instituicao || "[instituição]");
  return `Trabalho de Conclusão de Curso apresentado ao Curso de ${curso} da ${inst}, como requisito parcial para a obtenção do título de graduação.`;
}

function listaPalavras(str, fallback) {
  if (!str) return fallback;
  return str
    .split(/[;,]/)
    .map((p) => escapeLatex(p.trim()))
    .filter(Boolean)
    .join("; ");
}

// Resumo em portugues (NBR 14724). Sempre emitido: e elemento obrigatorio.
function blocoResumo(meta) {
  const texto = escapeLatex(meta.resumo || "Insira aqui o resumo do trabalho (150 a 500 palavras, em um unico paragrafo). % TODO");
  const palavras = listaPalavras(meta.palavrasChave, "Insira; as; palavras-chave");
  return [
    "\\begin{resumo}",
    texto,
    "\\par\\medskip",
    `\\noindent\\textbf{Palavras-chave}: ${palavras}.`,
    "\\end{resumo}",
    "",
  ].join("\n");
}

// Resumo em lingua estrangeira / Abstract (NBR 14724). Tambem obrigatorio.
function blocoAbstract(meta) {
  const texto = escapeLatex(meta.abstract || "Insert here the abstract (English version of the resumo). % TODO");
  const palavras = listaPalavras(meta.keywords, "Insert; the; keywords");
  return [
    "\\begin{resumo}[Abstract]",
    texto,
    "\\par\\medskip",
    `\\noindent\\textbf{Keywords}: ${palavras}.`,
    "\\end{resumo}",
    "",
  ].join("\n");
}

// Folha de aprovacao (NBR 14724): pagina padrao com espaco pra banca assinar.
function blocoFolhaAprovacao() {
  return [
    "\\begin{folhadeaprovacao}",
    "  {\\ABNTEXchapterfont\\large\\imprimirautor\\par}",
    "  \\begin{center}",
    "    \\vspace*{\\fill}\\vspace*{\\fill}",
    "    {\\ABNTEXchapterfont\\bfseries\\large\\imprimirtitulo}",
    "    \\vspace*{\\fill}",
    "  \\end{center}",
    "  \\noindent Trabalho aprovado em \\rule[-0.4ex]{2.5cm}{0.4pt} de \\rule[-0.4ex]{3.5cm}{0.4pt} de \\imprimirdata{}.",
    "  \\vspace*{\\fill}",
    "  \\begin{center}",
    "    \\rule{9cm}{0.4pt}\\\\",
    "    \\imprimirorientador{}\\\\Orientador(a)\\\\[1.8cm]",
    "    \\rule{9cm}{0.4pt}\\\\Examinador(a) 1\\\\[1.8cm]",
    "    \\rule{9cm}{0.4pt}\\\\Examinador(a) 2 % TODO: ajuste os membros da banca",
    "  \\end{center}",
    "  \\vspace*{\\fill}",
    "\\end{folhadeaprovacao}",
    "",
  ].join("\n");
}

// Listas de ilustracoes/tabelas: so quando o .docx realmente tiver figuras/tabelas.
function blocoListas({ temFiguras, temTabelas }) {
  const out = [];
  if (temFiguras) {
    out.push("\\pdfbookmark[0]{\\listfigurename}{lof}");
    out.push("\\listoffigures*");
    out.push("\\cleardoublepage", "");
  }
  if (temTabelas) {
    out.push("\\pdfbookmark[0]{\\listtablename}{lot}");
    out.push("\\listoftables*");
    out.push("\\cleardoublepage", "");
  }
  return out.join("\n");
}

// Listas de siglas e simbolos (opcionais em ABNT). Geradas comentadas como
// esqueleto: a autora descomenta e preenche so se realmente usar.
const SCAFFOLD_SIGLAS = `% ===== Lista de abreviaturas e siglas (opcional) =====
% Descomente e preencha SO se o trabalho usar siglas.
% \\begin{siglas}
%   \\item[ABNT] Associacao Brasileira de Normas Tecnicas
%   \\item[TOD] Transtorno de Oposicao Desafiante
% \\end{siglas}

% ===== Lista de simbolos (opcional) =====
% Descomente e preencha SO se o trabalho usar simbolos.
% \\begin{simbolos}
%   \\item[$\\Gamma$] Descricao do simbolo
% \\end{simbolos}
`;

export function montarTex(meta, corpo, opts = {}) {
  const { temFiguras = false, temTabelas = false } = opts;
  const titulo = escapeLatex(meta.titulo || "[título do trabalho]");
  const autor = escapeLatex(meta.autor || "[autor]");
  const instituicao = escapeLatex(meta.instituicao || "[instituição]");
  const orientador = escapeLatex(meta.orientador || "[orientador]");
  const cidade = escapeLatex(meta.cidade || "[cidade]");
  const ano = escapeLatex(meta.ano || "[ano]");

  const preambulo = `\\documentclass[
	12pt,
	oneside,
	a4paper,
	brazil
]{abntex2}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage{mathptmx}   % fonte serifada estilo Times (expectativa ABNT classica)
\\usepackage{graphicx}
\\usepackage{indentfirst}
\\usepackage{microtype}

% Remove as molduras vermelhas dos links no sumario/PDF (mantem clicavel, sem caixa).
\\hypersetup{hidelinks}

% ===== Metadados (gerados pelo auto-ABNT a partir do formulario) =====
\\titulo{${titulo}}
\\autor{${autor}}
\\local{${cidade}}
\\data{${ano}}
\\instituicao{${instituicao}}
\\orientador{${orientador}}
\\tipotrabalho{Trabalho de Conclusão de Curso}
\\preambulo{${preambuloSubmissao(meta)}}

% Margens ABNT: 3cm esq/sup, 2cm dir/inf
\\usepackage[top=3cm,left=3cm,right=2cm,bottom=2cm]{geometry}`;

  const folhaAprovacao = blocoFolhaAprovacao();
  const resumo = blocoResumo(meta);
  const abstract = blocoAbstract(meta);
  const listas = blocoListas({ temFiguras, temTabelas });

  const documento = `\\begin{document}
\\pretextual

\\imprimircapa
\\imprimirfolhaderosto

${folhaAprovacao}
${resumo}
${abstract}
${listas}${SCAFFOLD_SIGLAS}
% ===== Sumario (ABNT) =====
\\pdfbookmark[0]{\\contentsname}{toc}
\\tableofcontents*
\\cleardoublepage

\\textual

${corpo}

\\end{document}`;

  return `${preambulo}\n\n${documento}\n`;
}
