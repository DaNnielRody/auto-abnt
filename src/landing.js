// Cola fina do DOM da LANDING (slice #8). NÃO toca no fluxo da ferramenta
// (form → /format → preview → paywall → checkout → download vive em main.js).
// Responsabilidades:
//   1) Scroll suave dos links/CTA da navbar até as seções (#ferramenta etc.),
//      respeitando prefers-reduced-motion (salto instantâneo quando pedido).
//   2) Preço é DADO, não copy: no load chama GET /config e preenche o
//      {component.price-card} com pricing.formatted (mostra "…" até resolver).
//      NUNCA hardcode "R$ 9,90".

import { getConfig } from "./api.js";

// ---- 1) Scroll suave para âncoras internas (nav, hero, price, cta, footer) ----
const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

function scrollParaAlvo(hash) {
  const alvo = document.querySelector(hash);
  if (!alvo) return false;
  alvo.scrollIntoView({
    behavior: prefersReduced ? "auto" : "smooth",
    block: "start",
  });
  return true;
}

document.querySelectorAll("a[data-scroll]").forEach((link) => {
  link.addEventListener("click", (e) => {
    const href = link.getAttribute("href") || "";
    if (!href.startsWith("#")) return;
    if (scrollParaAlvo(href)) {
      e.preventDefault();
      // mantém a URL legível/compartilhável sem o salto nativo do browser
      window.history.replaceState({}, "", href);
    }
  });
});

// ---- 2) Preço do {component.price-card} via GET /config (fonte única) ----
const landingPrice = document.querySelector("#landing-price");

async function preencherPreco() {
  if (!landingPrice) return;
  try {
    const cfg = await getConfig();
    const p = cfg?.pricing?.formatted;
    if (p) landingPrice.textContent = p; // mostra o preço autoritativo
    // se não veio, mantém o "…" do HTML — nunca chuta um número
  } catch {
    // /config indisponível: mantém o placeholder "…"; sem número adivinhado
  }
}

preencherPreco();
