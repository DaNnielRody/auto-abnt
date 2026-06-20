// Orquestra o fluxo no navegador: le o formulario + .docx, monta o esqueleto
// .tex abnTeX2 client-side (converter.js + latex.js), posta {skeleton, metadata,
// ref} pro backend (/format), recebe o PDF compilado e mostra inline na
// {component.pdf-preview} dentro do {component.prompt-panel}. Download via
// {component.download-bar}. O front NAO fala com vendor nem guarda chaves.

import { converterDocx } from "./converter.js";
import { montarTex } from "./latex.js";
import { formatThesis, base64ToBytes } from "./api.js";
import "./style.css";

const form = document.querySelector("#form");
const fileInput = document.querySelector("#docx");
const status = document.querySelector("#status");
const resultado = document.querySelector("#resultado");
const submitBtn = form.querySelector('button[type="submit"]');
const previewFrame = document.querySelector("#preview-frame");
const previewPlaceholder = document.querySelector("#preview-placeholder");
const promptPanel = document.querySelector("#prompt-panel");
const downloadBar = document.querySelector("#download-bar");
const btnBaixarPdf = document.querySelector("#baixar-pdf");
const btnBaixarTex = document.querySelector("#baixar-tex");

// Mensagens calmas em PT por estado (DESIGN §7 status-message, 5 estados).
const STATUS_COPY = {
  convertendo: "Convertendo o .docx no seu navegador…",
  formatando: "Formatando em ABNT…",
  compilando: "Compilando o PDF…",
  pronto: "Pronto! Seu PDF está pronto para baixar.",
  erro: "Não conseguimos gerar o PDF. Tente novamente.",
};

// estado -> variante visual {component.status-message}
const STATUS_VARIANT = {
  convertendo: "info",
  formatando: "info",
  compilando: "info",
  pronto: "ok",
  erro: "erro",
};

// estados em que a UI esta "trabalhando" (botao desabilitado, download oculto).
const ESTADOS_TRABALHANDO = new Set(["convertendo", "formatando", "compilando"]);

// Recursos de blob em uso — revogados antes de cada nova geração.
let pdfUrl = "";
let texUrl = "";
let baseNome = "trabalho-abnt";

function lerMetadados() {
  const data = new FormData(form);
  return {
    titulo: data.get("titulo")?.trim(),
    autor: data.get("autor")?.trim(),
    instituicao: data.get("instituicao")?.trim(),
    curso: data.get("curso")?.trim(),
    orientador: data.get("orientador")?.trim(),
    cidade: data.get("cidade")?.trim(),
    ano: data.get("ano")?.trim(),
    resumo: data.get("resumo")?.trim(),
    palavrasChave: data.get("palavrasChave")?.trim(),
    abstract: data.get("abstract")?.trim(),
    keywords: data.get("keywords")?.trim(),
  };
}

function slug(titulo) {
  return (
    (titulo || "trabalho-abnt")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "trabalho-abnt"
  );
}

/**
 * Aplica um estado do fluxo: atualiza a status-message, o estado do botao
 * primario e a visibilidade da download-bar. Mensagem custom opcional (erro).
 */
function setEstado(estado, msgCustom) {
  status.textContent = msgCustom ?? STATUS_COPY[estado] ?? "";
  status.className = `status ${STATUS_VARIANT[estado] ?? "info"}`;
  submitBtn.disabled = ESTADOS_TRABALHANDO.has(estado);
  // download-bar só aparece em 'pronto'
  downloadBar.hidden = estado !== "pronto";
}

function baixar(href, nome) {
  const a = document.createElement("a");
  a.href = href;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Libera os blob URLs antigos (PDF/.tex) antes de criar novos. */
function revogarBlobs() {
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  if (texUrl) URL.revokeObjectURL(texUrl);
  pdfUrl = "";
  texUrl = "";
}

/**
 * Mostra o PDF inline no {component.pdf-preview}. O <iframe> nativo renderiza o
 * blob URL — sem nenhuma dependência (sem pdf.js). O placeholder some, o frame
 * aparece e o painel ganha a borda verde de "pronto" ({component.prompt-panel-ready}).
 */
function mostrarPreview(url) {
  previewFrame.src = url;
  previewFrame.hidden = false;
  previewPlaceholder.hidden = true;
  promptPanel.classList.add("ready"); // borda superior signal-bright
}

/** Volta o painel ao estado vazio (placeholder), sem PDF montado. */
function limparPreview() {
  previewFrame.removeAttribute("src");
  previewFrame.hidden = true;
  previewPlaceholder.hidden = false;
  promptPanel.classList.remove("ready");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    setEstado("erro", "Selecione um arquivo .docx primeiro.");
    return;
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    setEstado("erro", "Por enquanto só aceitamos .docx (o Word original).");
    return;
  }

  try {
    // 1) Converte o .docx no navegador.
    setEstado("convertendo");
    const meta = lerMetadados();
    baseNome = slug(meta.titulo);
    const arrayBuffer = await file.arrayBuffer();
    const { corpo, imagens, temTabelas, avisos } = await converterDocx(arrayBuffer);

    // 2) Monta o esqueleto .tex abnTeX2 client-side (mesma lógica de sempre).
    const skeleton = montarTex(meta, corpo, {
      temFiguras: imagens.length > 0,
      temTabelas,
    });
    if (avisos.length) console.warn("Avisos do mammoth:", avisos);

    // 3) Posta esqueleto + metadados pro backend formatar + compilar o PDF.
    setEstado("formatando");
    resultado.hidden = false;
    const ref = `${baseNome}-${Date.now()}`;
    const job = await formatThesis({ skeleton, metadata: meta, ref });

    setEstado("compilando");
    if (!job.previewPdf) {
      throw new Error("o backend não devolveu o PDF compilado");
    }

    // 4) Renderiza o PDF inline + prepara os downloads.
    revogarBlobs();
    const pdfBytes = base64ToBytes(job.previewPdf);
    pdfUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
    texUrl = URL.createObjectURL(new Blob([skeleton], { type: "text/x-tex" }));
    mostrarPreview(pdfUrl);

    setEstado("pronto");
    if (job.warnings?.length) console.warn("Avisos do formatador:", job.warnings);
    resultado.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    revogarBlobs();
    limparPreview();
    setEstado("erro");
  }
});

btnBaixarPdf.addEventListener("click", () => {
  if (pdfUrl) baixar(pdfUrl, `${baseNome}.pdf`);
});

btnBaixarTex.addEventListener("click", () => {
  if (texUrl) baixar(texUrl, `${baseNome}.tex`);
});

// Libera os blob URLs ao sair da página.
window.addEventListener("beforeunload", revogarBlobs);
