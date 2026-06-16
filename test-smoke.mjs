// Teste headless: monta um .docx minimo, roda o conversor sob jsdom e imprime o .tex.
import JSZip from "jszip";
import { JSDOM } from "jsdom";

// DOMParser global pro converter.js funcionar fora do navegador.
global.DOMParser = new JSDOM().window.DOMParser;

const { converterDocx } = await import("./src/converter.js");
const { montarTex } = await import("./src/latex.js");

function p(text, style) {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}
function pBold(text) {
  return `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${p("Introdução", "Heading1")}
${p("Este texto tem caracteres perigosos: 50% &amp; custo_total #1.")}
${p("2.1 Objetivos específicos")}
${pBold("Trecho em negrito de teste.")}
${p("DESENVOLVIMENTO")}
${p("Conteúdo do desenvolvimento aqui.")}
${p("REFERÊNCIAS")}
${p("SILVA, João. Título do livro. São Paulo: Editora, 2020.")}
</w:body>
</w:document>`;

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
</w:styles>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const zip = new JSZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", rels);
zip.file("word/document.xml", documentXml);
zip.file("word/styles.xml", stylesXml);
zip.file("word/_rels/document.xml.rels", docRels);

const nodeBuffer = await zip.generateAsync({ type: "nodebuffer" });
const { corpo, imagens } = await converterDocx({ buffer: nodeBuffer });
const tex = montarTex(
  {
    titulo: "A influência da tecnologia & cia",
    autor: "Maria Teste",
    instituicao: "Universidade Federal",
    curso: "Pedagogia",
    orientador: "Prof. Dr. Fulano",
    cidade: "São Paulo",
    ano: "2026",
    resumo: "Resumo de teste com 100% de cobertura.",
    palavrasChave: "educação; tecnologia",
  },
  corpo
);

console.log("===== CORPO =====\n" + corpo);
console.log("\n===== IMAGENS:", imagens.length, "=====");
console.log("\n===== .TEX (preambulo + inicio) =====\n" + tex.slice(0, 900));
