// Gera o prompt pronto pra usuaria colar no ChatGPT dela junto com o .tex.
// Aqui mora a parte "inteligente" que a ferramenta NAO faz (de proposito):
// referencias NBR 6023, citacoes NBR 10520 e casos ambiguos de titulo.

export const PROMPT_CHATGPT = `Você é um especialista em normas ABNT (NBR 14724, 6023, 10520) e em LaTeX (classe abntex2). Vou colar abaixo um arquivo .tex gerado automaticamente a partir de um .docx. Ele é um RASCUNHO de estrutura. NÃO invente resultados, dados, autores ou conteúdo acadêmico que não exista no texto. Você pode corrigir formatação/estrutura livremente e, onde faltar conteúdo obrigatório, inserir um marcador claro em vez de fabricar.

Faça, nesta ordem:

1. ESTRUTURA DE CAPÍTULOS. Conserte títulos que vieram errados da conversão da capa:
   - O título real do trabalho já está em \\titulo{} no preâmbulo. Se ele reaparecer como capítulo/parágrafo no corpo, remova a duplicata.
   - Remova "capítulos" que na verdade são dados de capa que vazaram: rótulos tipo "PARCIAL 2", o nome da cidade/local (ex.: "GUARAPARI-ES"), o ano sozinho, e os nomes dos autores — tudo isso já está na capa e folha de rosto.
   - Garanta que o primeiro capítulo real seja a INTRODUÇÃO e renumere a hierarquia (\\chapter/\\section/\\subsection) de forma coerente.

2. PALAVRAS GRUDADAS. Conserte trechos sem espaço que vieram de copiar/colar de PDF (ex.: "formulaçãocognitivo-comportamentaldoTOD" → "formulação cognitivo-comportamental do TOD"). Não altere o sentido.

3. REFERÊNCIAS (NBR 6023). Reorganize em ordem alfabética e no padrão AUTOR. Título. Local: Editora, ano. Onde faltarem dados (autor, periódico, volume, número, páginas, ano, DOI/URL), mantenha o que existe e marque o que falta com [VERIFICAR: ...]. Não invente os dados ausentes.

4. CITAÇÕES (NBR 10520). Onde o texto faz afirmações factuais (ex.: prevalências, eficácia, definições), insira a citação autor-data correspondente SE a fonte estiver entre as referências. Quando a afirmação não tiver fonte identificável, insira "(AUTOR, ANO)" como marcador e liste essa lacuna no relatório final — não atribua a um autor inventado.

5. RESUMO E ABSTRACT. Verifique se têm ~150–500 palavras em parágrafo único. Se estiverem vazios, com texto-placeholder (ex.: "cachumba") ou curtos demais, NÃO escreva o resumo por conta própria: marque com "% TODO: resumo de 150–500 palavras" e avise no relatório.

6. SEÇÕES OBRIGATÓRIAS FALTANTES. Se faltarem seções exigidas em um TCC (ex.: METODOLOGIA; e, dentro da INTRODUÇÃO, justificativa, problema de pesquisa e objetivos), insira a seção com um marcador claro (ex.: \\section{METODOLOGIA} seguido de "% TODO: a autora deve descrever ...") e liste no relatório. Não fabrique método nem resultados.

7. COMPILAÇÃO. Garanta que compila no Overleaf sem erro (ambientes fechados, caracteres especiais escapados, sem comandos inexistentes).

Ao final, devolva DOIS blocos:
A) o arquivo .tex completo e corrigido, em um único bloco de código, pronto pra colar no Overleaf;
B) um checklist curto "O QUE SÓ VOCÊ PODE COMPLETAR" listando tudo que ficou marcado como [VERIFICAR]/TODO (citações sem fonte, dados de referência faltantes, resumo/abstract, metodologia, justificativa) — para a autora preencher.

Aqui está o arquivo:

`;
