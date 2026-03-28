function normalizeAutoFill(editions) {
  let series_name = '';
  let series_position = '';

  if (editions.length > 0) {
    const counts = {};
    
    for (const ed of editions) {
      if (!ed.series) continue;
      const seriesList = Array.isArray(ed.series) ? ed.series : [ed.series];
      
      for (const edSeries of seriesList) {
        if (!edSeries || typeof edSeries !== 'string') continue;
        
        const match = edSeries.match(/^(.*?)[,\s]*\(?(?:book|#|v|tome|part)?\s*(\d+(\.\d+)?)\)?$/i);
        let name = '', pos = '';
        
        if (match) {
          name = match[1].replace(/[()]/g, '').trim();
          pos = match[2];
        } else {
          name = edSeries.replace(/[()]/g, '').trim();
        }

        if (name) {
          const key = name.toLowerCase();
          if (!counts[key]) counts[key] = { name, pos, score: 0 };
          counts[key].score += 1;
          if (pos) {
            counts[key].score += 5;
            if (!counts[key].pos) counts[key].pos = pos;
            else if (pos !== '1' && counts[key].pos === '1') counts[key].pos = pos;
          }
        }
      }
    }

    const sorted = Object.values(counts).sort((a, b) => b.score - a.score);
    const bestMatch = sorted[0];
    if (bestMatch && bestMatch.score >= 1) {
      series_name = bestMatch.name;
      series_position = bestMatch.pos;
    }
  }
  return { series_name, series_position };
}

const duneEditions = [
  { series: ["Dune"] },
  { series: ["Ailleurs & Demain"] },
  { series: ["Dune, tome 1"] }, // Mislabeled
  { series: ["Dune (Book 2)"] }, // Correct (hypothetical addition to check logic)
];

console.log("Dune Messiah Result (with mix):", normalizeAutoFill(duneEditions));

const realDuneEditions = [
  { series: ["Dune"] },
  { series: ["Ailleurs & Demain"] },
  { series: ["Dune, tome 1"] },
];
console.log("Dune Messiah Result (real data):", normalizeAutoFill(realDuneEditions));
