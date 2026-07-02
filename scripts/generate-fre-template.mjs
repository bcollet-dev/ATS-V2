// Run once: node scripts/generate-fre-template.mjs
// Generates public/templates/fre-template.docx with {{field}} syntax for docxtemplater

import PizZip from "pizzip";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "../public/templates/fre-template.docx");

function p(text, bold = false) {
  const rpr = bold ? `<w:rPr><w:b/></w:rPr>` : "";
  return `<w:p><w:r>${rpr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

function row(label, field) {
  return `
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:tcPr>
        <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${label}</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="5500" w:type="dxa"/></w:tcPr>
        <w:p><w:r><w:t xml:space="preserve">{{${field}}}</w:t></w:r></w:p>
      </w:tc>
    </w:tr>`;
}

function section(title, rows) {
  return `
    ${p(title, true)}
    <w:p/>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="8500" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/>
        </w:tblBorders>
      </w:tblPr>
      ${rows.map(([label, field]) => row(label, field)).join("")}
    </w:tbl>
    <w:p/>`;
}

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${p("FICHE DE RÉMUNÉRATION DE L'ALTERNANT (FRE)", true)}
    <w:p/>

    ${section("1. ALTERNANT", [
      ["Civilité", "candidateCivilite"],
      ["Nom de naissance", "candidateLastName"],
      ["Prénom", "candidateFirstName"],
      ["Date de naissance", "candidateBirthDate"],
      ["Numéro de sécurité sociale (NIR)", "candidateNir"],
      ["Établissement précédent", "candidatePreviousSchool"],
    ])}

    ${section("2. FORMATION", [
      ["Cursus / Diplôme préparé", "cursusName"],
      ["Date de début", "startDate"],
      ["Date de fin", "endDate"],
    ])}

    ${section("3. EMPLOYEUR", [
      ["Raison sociale", "companyName"],
      ["SIRET", "companySiret"],
      ["Code NAF", "companyNafCode"],
      ["Adresse", "companyAddress"],
      ["Code postal", "companyPostalCode"],
      ["Ville", "companyCity"],
      ["Code IDCC", "companyIdcc"],
      ["Convention collective", "companyCollectiveAgreement"],
      ["OPCO", "companyOpco"],
      ["Caisse de retraite complémentaire", "companyRetirementFund"],
      ["Organisme de prévoyance", "companyProvidentFund"],
      ["Représentant légal — Prénom", "companyLegalRepFirstName"],
      ["Représentant légal — Nom", "companyLegalRepLastName"],
    ])}

    ${section("4. MAÎTRE D'APPRENTISSAGE", [
      ["Prénom", "masterFirstName"],
      ["Nom", "masterLastName"],
      ["Date de naissance", "masterBirthDate"],
      ["Fonction", "masterJobTitle"],
      ["Téléphone", "masterPhone"],
      ["Email", "masterEmail"],
    ])}

    ${section("5. CONTRAT", [
      ["Type de contrat", "contractType"],
      ["Durée hebdomadaire (heures)", "weeklyHours"],
      ["Référence de salaire", "salaryReference"],
      ["Montant SMC (si applicable)", "smcAmount"],
      ["Heures supplémentaires", "overtimeHandling"],
    ])}

    ${section("6. AVANTAGES EN NATURE", [
      ["Repas (€/repas)", "benefitFood"],
      ["Logement (€/mois)", "benefitHousing"],
      ["Autres avantages", "benefitOther"],
    ])}

    <w:p/>
    ${p("Document généré automatiquement par EDA ATS — à compléter si nécessaire avant envoi.")}
    <w:sectPr/>
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const relsRoot = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const relsWord = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

const zip = new PizZip();
zip.file("[Content_Types].xml", contentTypes);
zip.file("_rels/.rels", relsRoot);
zip.file("word/document.xml", documentXml);
zip.file("word/_rels/document.xml.rels", relsWord);

mkdirSync(join(__dirname, "../public/templates"), { recursive: true });
const buf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(outPath, buf);
console.log("Template créé :", outPath);
