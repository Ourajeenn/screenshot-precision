import type { Control } from "./store";

export async function exportPDF(c: Control) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(16);
  doc.text("InspectVision — Rapport de contrôle", 14, y);
  doc.setFontSize(9);
  y += 8;
  const lines = [
    `Identifiant : ${c.id}`,
    `Date (UTC) : ${c.createdAt}   Version : ${c.appVersion}`,
    `Référence matériau : ${c.reference}`,
    `Image : ${c.imageName} (${c.imageWidth}×${c.imageHeight} px)`,
    `SHA-256 : ${c.imageHash}`,
    `Méthode : ${c.params.method}   Paramètres : ${JSON.stringify(c.params)}`,
  ];
  for (const l of lines) {
    const wrapped = doc.splitTextToSize(l, 182);
    doc.text(wrapped, 14, y);
    y += 5 * wrapped.length;
  }
  y += 2;
  doc.addImage(c.originalThumb, "JPEG", 14, y, 88, 66, undefined, "FAST");
  doc.addImage(c.annotatedThumb, "JPEG", 108, y, 88, 66, undefined, "FAST");
  y += 72;
  doc.setFontSize(11);
  doc.text(`Zones suspectes : ${c.regions.length}`, 14, y);
  doc.setFontSize(9);
  y += 6;
  for (const r of c.regions.slice(0, 15)) {
    doc.text(`#${r.id}  x=${r.x} y=${r.y}  ${r.width}×${r.height} px  surface ${r.area} px²`, 16, y);
    y += 4.5;
  }
  if (c.regions.length > 15) { doc.text(`… ${c.regions.length - 15} autres`, 16, y); y += 4.5; }
  y += 4;
  doc.setFontSize(11);
  doc.text(`Décision de l'opérateur : ${c.decision}`, 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(`Observations : ${c.comment || "—"}`, 182), 14, y);
  doc.setTextColor(120);
  doc.text(
    doc.splitTextToSize(
      "Avertissement : les zones signalées sont des alertes algorithmiques (régions visuellement inhabituelles), pas des défauts avérés. Prototype non certifié ; la décision relève de l'opérateur.",
      182,
    ),
    14,
    282,
  );
  doc.save(`inspectvision_${c.id}.pdf`);
}
