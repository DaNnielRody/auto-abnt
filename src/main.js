// Orquestra o fluxo no navegador: le o formulario + .docx, monta o esqueleto
// .tex abnTeX2 client-side (converter.js + latex.js), posta {skeleton, metadata,
// ref} pro backend (/format), recebe o PDF compilado e mostra inline na
// {component.pdf-preview} dentro do {component.prompt-panel}. Download via
// {component.download-bar}. O front NAO fala com vendor nem guarda chaves.

import { converterDocx } from "./converter.js";
import { montarTex } from "./latex.js";
import {
  formatThesis,
  base64ToBytes,
  startCheckout,
  downloadPdf,
  getConfig,
  DownloadError,
} from "./api.js";
import "./style.css";

const form = document.querySelector("#form");
const fileInput = document.querySelector("#docx");
const status = document.querySelector("#status");
const resultado = document.querySelector("#resultado");
const submitBtn = form.querySelector('button[type="submit"]');
const previewFrame = document.querySelector("#preview-frame");
const previewPlaceholder = document.querySelector("#preview-placeholder");
const promptPanel = document.querySelector("#prompt-panel");
const paywall = document.querySelector("#paywall");
const paywallPrice = document.querySelector("#paywall-price");
const paywallCanceledNote = document.querySelector("#paywall-canceled-note");
const btnPagar = document.querySelector("#pagar");
const downloadBar = document.querySelector("#download-bar");
const btnBaixarPdf = document.querySelector("#baixar-pdf");
const btnBaixarTex = document.querySelector("#baixar-tex");

// Mensagens calmas em PT por estado (DESIGN §7 status-message, 5 estados).
const STATUS_COPY = {
  convertendo: "Convertendo o .docx no seu navegador…",
  formatando: "Formatando em ABNT…",
  compilando: "Compilando o PDF…",
  pronto: "Pronto! Seu PDF está pronto para baixar.",
  pago: "Pagamento confirmado. Seu PDF está liberado para baixar.",
  erro: "Não conseguimos gerar o PDF. Tente novamente.",
};

// estado -> variante visual {component.status-message}
const STATUS_VARIANT = {
  convertendo: "info",
  formatando: "info",
  compilando: "info",
  pronto: "ok",
  pago: "ok",
  erro: "erro",
};

// estados em que a UI esta "trabalhando" (botao desabilitado, download oculto).
const ESTADOS_TRABALHANDO = new Set(["convertendo", "formatando", "compilando"]);

// Recursos de blob em uso — revogados antes de cada nova geração.
let pdfUrl = "";
let texUrl = "";
let baseNome = "trabalho-abnt";
// Id do job retido no servidor (chave pra checkout/download por id+chargeId).
let jobAtualId = "";
// Preço autoritativo vindo do servidor (pricing.formatted). Nunca hardcode.
let precoFormatado = "";

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
 * primario e a visibilidade do paywall / download-bar.
 *
 * Gate de pagamento (slice #9):
 *  - 'pronto' (não pago) → mostra {component.paywall}; download-bar oculta.
 *  - 'pago' (verificado pelo servidor) → mostra {component.download-bar};
 *    paywall oculto.
 * O paywall e a download-bar nunca aparecem juntos (single black pill).
 */
function setEstado(estado, msgCustom) {
  status.textContent = msgCustom ?? STATUS_COPY[estado] ?? "";
  status.className = `status ${STATUS_VARIANT[estado] ?? "info"}`;
  submitBtn.disabled = ESTADOS_TRABALHANDO.has(estado);
  // paywall só no 'pronto' não-pago; download-bar só no 'pago'
  paywall.hidden = estado !== "pronto";
  downloadBar.hidden = estado !== "pago";
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

    // 5) Guarda o id do job (retido no servidor) + o preço autoritativo, e
    //    monta o paywall: o preview é o valor mostrado ANTES de pagar.
    jobAtualId = job.id || "";
    aplicarPreco(job.pricing?.formatted);
    paywallCanceledNote.hidden = true;
    btnBaixarTex.hidden = false; // .tex disponível no fluxo normal (esqueleto em memória)
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

/**
 * Interpola o preço (data, não copy) no {component.paywall} e no rótulo do
 * {component.pay-button}. Fonte = pricing.formatted do servidor; nunca hardcode.
 */
function aplicarPreco(formatado) {
  if (formatado) precoFormatado = formatado;
  const p = precoFormatado;
  paywallPrice.textContent = p || "…";
  btnPagar.textContent = p ? `Pagar ${p} e baixar` : "Pagar e baixar";
}

// ===== Pay → checkout → redirect (Stripe hosted) =====
btnPagar.addEventListener("click", async () => {
  if (!jobAtualId) return;
  // {component.pay-button -loading}: button-primary-disabled + label trocado.
  btnPagar.disabled = true;
  btnPagar.textContent = "Redirecionando…";
  try {
    const { checkoutUrl } = await startCheckout(jobAtualId);
    if (!checkoutUrl) throw new Error("o backend não devolveu a URL de checkout");
    // Redireciona pra página hospedada do Stripe (sem Stripe.js na página).
    window.location.assign(checkoutUrl);
  } catch (err) {
    console.error(err);
    // Volta o botão e mostra um aviso calmo; o paywall permanece.
    btnPagar.disabled = false;
    aplicarPreco();
    setEstado("erro", "Não conseguimos iniciar o pagamento. Tente de novo.");
    // Mantém o paywall visível mesmo no aviso de erro do checkout.
    paywall.hidden = false;
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

// ===== Retorno do Stripe (detectado no load) =====
// Depois do redirect a SPA perdeu o estado em memória, mas o job vive no
// servidor (store em memória) — o download funciona por id+chargeId da query.
// NUNCA confiamos no flag paid=1: ele só DISPARA a verificação no servidor.

/** Remove os params de pagamento da URL pra um refresh não re-disparar. */
function limparQuery() {
  const url = new URL(window.location.href);
  ["job", "chargeId", "paid", "canceled"].forEach((k) =>
    url.searchParams.delete(k),
  );
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

/**
 * Reaplica o preço autoritativo do servidor (GET /config) no paywall. Usado nos
 * retornos do Stripe, onde o preço da resposta de /format não está mais em mãos.
 * Fonte única; se /config falhar, mantém o último preço conhecido (aplicarPreco()).
 */
async function reaplicarPrecoDoServidor() {
  try {
    const cfg = await getConfig();
    aplicarPreco(cfg.pricing?.formatted);
  } catch {
    aplicarPreco();
  }
}

/** Mostra o resultado (precisa estar visível pra exibir o paywall/download). */
function mostrarResultado() {
  resultado.hidden = false;
  resultado.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * Pós-pagamento: pede o PDF liberado pelo servidor (id+chargeId). O servidor
 * decide — 402/403 mantêm o paywall com um aviso calmo; 200 mostra a download-bar.
 */
async function tratarRetornoPago(jobId, chargeId) {
  jobAtualId = jobId;
  mostrarResultado();
  try {
    const blob = await downloadPdf(jobId, chargeId);
    // Pago + verificado: prepara o download do PDF entregue pelo servidor.
    revogarBlobs();
    pdfUrl = URL.createObjectURL(blob);
    // O preview pode não ser re-exibido após o redirect — tudo bem; o objetivo
    // pós-pago é entregar o download. Acende a borda "ready" como confirmação.
    promptPanel.classList.add("ready");
    // Sem .tex após o redirect (esqueleto vivia só em memória): esconde o botão.
    btnBaixarTex.hidden = true;
    setEstado("pago");
  } catch (err) {
    console.error(err);
    // Servidor recusou (não pago / chargeId não confere): mantém o paywall.
    let msg = "Não foi possível liberar o download. Tente o pagamento de novo.";
    if (err instanceof DownloadError && err.kind === "unpaid") {
      msg = "Ainda não recebemos a confirmação do pagamento. Tente de novo.";
    }
    await reaplicarPrecoDoServidor();
    setEstado("erro", msg);
    paywall.hidden = false; // re-mostra o paywall (setEstado('erro') o esconde)
  }
}

/** Retorno do cancel_url: re-mostra o paywall + nota calma (não é erro). */
async function tratarRetornoCancelado() {
  mostrarResultado();
  await reaplicarPrecoDoServidor();
  paywallCanceledNote.hidden = false;
  setEstado("pronto"); // mostra o paywall; status -ok "pronto pra baixar"
}

function tratarRetornoStripe() {
  const params = new URLSearchParams(window.location.search);
  const paid = params.get("paid");
  const canceled = params.get("canceled");
  const jobId = params.get("job");
  const chargeId = params.get("chargeId");

  // limparQuery() roda já (sem await): limpa os params ANTES do download async
  // terminar, pra que um refresh durante o processo não re-dispare a verificação.
  // Os handlers tratam seus próprios erros internamente (try/catch), então o
  // fire-and-forget não deixa rejection sem tratamento.
  if (paid === "1" && jobId && chargeId) {
    tratarRetornoPago(jobId, chargeId);
    limparQuery();
  } else if (canceled === "1") {
    tratarRetornoCancelado();
    limparQuery();
  }
}

tratarRetornoStripe();
