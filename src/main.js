// Orquestra o fluxo no navegador: le o formulario + .docx, converte,
// monta o .tex abnTeX2 e entrega o download (.tex puro ou .zip com /imagens).

import JSZip from "jszip";
import { converterDocx } from "./converter.js";
import { montarTex } from "./latex.js";
import { PROMPT_CHATGPT } from "./handoff.js";
import "./style.css";

const form = document.querySelector("#form");
const fileInput = document.querySelector("#docx");
const status = document.querySelector("#status");
const resultado = document.querySelector("#resultado");
const btnPrompt = document.querySelector("#copiar-prompt");
const txtPrompt = document.querySelector("#prompt");
const btnChatGPT = document.querySelector("#abrir-chatgpt");
const btnClaude = document.querySelector("#abrir-claude");

const AI_URLS = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
};

let ultimoTex = "";

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

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setStatus(msg, tipo = "info") {
  status.textContent = msg;
  status.className = `status ${tipo}`;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    setStatus("Selecione um arquivo .docx primeiro.", "erro");
    return;
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    setStatus("Por enquanto só aceitamos .docx (o Word original).", "erro");
    return;
  }

  try {
    setStatus("Convertendo… isso acontece tudo no seu navegador.", "info");
    const meta = lerMetadados();
    const arrayBuffer = await file.arrayBuffer();
    const { corpo, imagens, temTabelas, avisos } = await converterDocx(arrayBuffer);
    const tex = montarTex(meta, corpo, {
      temFiguras: imagens.length > 0,
      temTabelas,
    });
    ultimoTex = tex;

    const baseNome = (meta.titulo || "trabalho-abnt")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "trabalho-abnt";

    if (imagens.length) {
      const zip = new JSZip();
      zip.file(`${baseNome}.tex`, tex);
      const pasta = zip.folder("imagens");
      imagens.forEach((img) => pasta.file(img.nome, img.base64, { base64: true }));
      const blob = await zip.generateAsync({ type: "blob" });
      baixar(blob, `${baseNome}.zip`);
      setStatus(
        `Pronto! Baixamos um .zip com o .tex e ${imagens.length} imagem(ns). No Overleaf use "New Project → Upload Project".`,
        "ok"
      );
    } else {
      baixar(new Blob([tex], { type: "text/x-tex" }), `${baseNome}.tex`);
      setStatus("Pronto! Baixamos o arquivo .tex.", "ok");
    }

    if (avisos.length) {
      console.warn("Avisos do mammoth:", avisos);
    }
    // Popula o prompt-panel imediatamente (DESIGN: prompt-panel-ready).
    txtPrompt.value = PROMPT_CHATGPT + ultimoTex;
    resultado.hidden = false;
    resultado.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    setStatus(
      "Algo deu errado ao ler o arquivo. Confira se é um .docx válido.",
      "erro"
    );
  }
});

function promptCompleto() {
  return PROMPT_CHATGPT + (ultimoTex || "<gere o arquivo primeiro>");
}

async function copiarPrompt() {
  const texto = promptCompleto();
  txtPrompt.value = texto;
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    txtPrompt.select();
    return false;
  }
}

btnPrompt.addEventListener("click", async () => {
  const ok = await copiarPrompt();
  if (ok) {
    btnPrompt.classList.add("copied");
    btnPrompt.textContent = "Copiado! ✓";
    setTimeout(() => {
      btnPrompt.classList.remove("copied");
      btnPrompt.textContent = "Copiar";
    }, 2000);
  }
});

// AI-launch: copia o prompt+.tex pra área de transferência e abre a IA em nova
// aba. O payload (.tex) é grande demais pra caber numa URL, então o padrão é
// copiar-e-abrir (ver DESIGN.md §11, ai-launch-button).
async function abrirIA(provider) {
  await copiarPrompt();
  window.open(AI_URLS[provider], "_blank", "noopener");
  setStatus(
    "Prompt + .tex copiados. Cole (Ctrl/Cmd+V) na IA que abriu em outra aba.",
    "ok"
  );
}

btnChatGPT.addEventListener("click", () => abrirIA("chatgpt"));
btnClaude.addEventListener("click", () => abrirIA("claude"));
