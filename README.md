# auto-ABNT

Página estática que converte um **`.docx`** no esqueleto **LaTeX/abnTeX2** (normas ABNT)
e devolve um arquivo pronto pra refinar no ChatGPT e compilar no Overleaf.
**Roda 100% no navegador** — nada é enviado a servidor, nada é armazenado.

## Fluxo

1. A pessoa abre a página, preenche os dados da capa (título, autor, instituição,
   orientador, cidade, ano, resumo, palavras-chave) e sobe o `.docx`.
2. A página gera, **localmente**, o `.tex` abnTeX2:
   - capa + folha de rosto a partir do formulário;
   - corpo convertido do `.docx` (títulos por Estilo do Word **+** heurística de
     numeração/CAIXA ALTA → `\chapter`/`\section`/...);
   - caracteres especiais escapados, citações longas, listas, tabelas e figuras;
   - se houver imagens, baixa um **`.zip`** com `/imagens` + `\includegraphics`.
3. A pessoa **cola no ChatGPT** (botão copia o prompt + o `.tex`) pra acertar
   títulos ambíguos, **referências (NBR 6023)** e **citações (NBR 10520)**.
4. **Compila no Overleaf**: projeto em branco (ou *Upload Project* se for `.zip`),
   cola o `.tex` final e dá *Recompile* → PDF.

> A "inteligência" (referências/citações) fica de propósito no ChatGPT da usuária —
> a ferramenta não usa IA nem backend, por isso custo zero.

## Rodar local

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/ estático
npm test         # smoke test headless do conversor (jsdom)
```

## Publicar (grátis, estático)

Qualquer host de estático serve o `dist/`:

- **Vercel**: `Framework Preset: Vite`, build `npm run build`, output `dist`.
- **Netlify**: build `npm run build`, publish `dist`.
- **GitHub Pages**: publique o conteúdo de `dist/` (a `base: "./"` já está configurada).

## Escopo (MVP) e limites

- **Entrada:** só `.docx`. `.pdf` e `.doc` ficaram para depois (extração ruidosa).
- O `.tex` é um **rascunho**: pode precisar de ajuste no ChatGPT/Overleaf
  (tabelas complexas, equações, referências). O passo Overleaf não é opcional.
- Não compila PDF nem usa LaTeX no servidor — isso acontece no Overleaf.
