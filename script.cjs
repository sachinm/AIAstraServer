const fs = require('fs');
const readline = require('readline');

const inputPath = 'notes.txt';
const outputPath = 'kundli.json';

const kundliData = {
  metadata: {
    date: null,
    time: null,
    timeZone: null,
    place: null,
    coordinates: null,
    altitude: null,
    lunarYearMonth: null,
    tithi: null,
    vedicWeekday: null,
    nakshatra: null,
    yoga: null,
    karana: null,
    horaLord: null,
    mahakalaHora: null,
    kaalaLord: null,
    sunrise: null,
    sunset: null,
    janmaGhatis: null,
    ayanamsa: null,
    siderealTime: null
  },
  planetaryPositions: [],
  charaKarakas: [],
  ashtakavarga: {},
  planetaryStrengths: [],
  vargaCharts: {},
  dasas: {
    vimshottari: [],
    moola: [],
    ashtottari: [],
    kalachakra: [],
    narayana: [],
    sudasa: []
  }
};

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath),
  crlfDelay: Infinity
});

let currentSection = '';
let currentDasaSystem = '';

rl.on('line', (line) => {
  line = line.trim();

  // Section detection
  if (line.startsWith('Date:')) {
    currentSection = 'metadata';
    kundliData.metadata.date = line.split(':')[1].trim();
  } 
  else if (line.startsWith('Time:')) {
    kundliData.metadata.time = line.split(':')[1].trim();
  }
  else if (line.startsWith('Time Zone:')) {
    kundliData.metadata.timeZone = line.split(':')[1].trim();
  }
  else if (line.startsWith('Place:')) {
    const placeParts = line.split(':')[1].trim().split(',');
    kundliData.metadata.coordinates = placeParts[0].trim();
    kundliData.metadata.place = placeParts.slice(1).join(',').trim();
  }
  else if (line.startsWith('Altitude:')) {
    kundliData.metadata.altitude = line.split(':')[1].trim();
  }
  else if (line.startsWith('Lunar Yr-Mo:')) {
    kundliData.metadata.lunarYearMonth = line.split(':')[1].trim();
  }
  else if (line.startsWith('Tithi:')) {
    kundliData.metadata.tithi = line.split(':')[1].trim();
  }
  else if (line.startsWith('Vedic Weekday:')) {
    kundliData.metadata.vedicWeekday = line.split(':')[1].trim();
  }
  else if (line.startsWith('Nakshatra:')) {
    kundliData.metadata.nakshatra = line.split(':')[1].trim();
  }
  else if (line.startsWith('Yoga:')) {
    kundliData.metadata.yoga = line.split(':')[1].trim();
  }
  else if (line.startsWith('Karana:')) {
    kundliData.metadata.karana = line.split(':')[1].trim();
  }
  else if (line.startsWith('Hora Lord:')) {
    kundliData.metadata.horaLord = line.split(':')[1].trim();
  }
  else if (line.startsWith('Mahakala Hora:')) {
    kundliData.metadata.mahakalaHora = line.split(':')[1].trim();
  }
  else if (line.startsWith('Kaala Lord:')) {
    kundliData.metadata.kaalaLord = line.split(':')[1].trim();
  }
  else if (line.startsWith('Sunrise:')) {
    kundliData.metadata.sunrise = line.split(':')[1].trim();
  }
  else if (line.startsWith('Sunset:')) {
    kundliData.metadata.sunset = line.split(':')[1].trim();
  }
  else if (line.startsWith('Janma Ghatis:')) {
    kundliData.metadata.janmaGhatis = line.split(':')[1].trim();
  }
  else if (line.startsWith('Ayanamsa:')) {
    kundliData.metadata.ayanamsa = line.split(':')[1].trim();
  }
  else if (line.startsWith('Sidereal Time:')) {
    kundliData.metadata.siderealTime = line.split(':')[1].trim();
  }
  else if (line.startsWith('Body') && line.includes('Longitude')) {
    currentSection = 'planetaryPositions';
  }
  else if (line.startsWith('Chara karaka')) {
    currentSection = 'charaKarakas';
  }
  else if (line.startsWith('Ashtakavarga of Rasi Chart:')) {
    currentSection = 'ashtakavarga';
  }
  else if (line.startsWith('Planet') && line.includes('Shadbala')) {
    currentSection = 'planetaryStrengths';
  }
  else if (line.startsWith('Vimsottari Dasa')) {
    currentSection = 'dasas';
    currentDasaSystem = 'vimshottari';
  }
  else if (line.startsWith('Moola Dasa')) {
    currentSection = 'dasas';
    currentDasaSystem = 'moola';
  }
  else if (line.startsWith('Ashtottari Dasa')) {
    currentSection = 'dasas';
    currentDasaSystem = 'ashtottari';
  }
  else if (line.startsWith('Kalachakra Dasa')) {
    currentSection = 'dasas';
    currentDasaSystem = 'kalachakra';
  }
  else if (line.startsWith('Narayana Dasa')) {
    currentSection = 'dasas';
    currentDasaSystem = 'narayana';
  }
  else if (line.startsWith('Sudasa')) {
    currentSection = 'dasas';
    currentDasaSystem = 'sudasa';
  }
  else if (line.startsWith('+---') && line.includes('D-')) {
    // Detect varga charts (D-1, D-9, etc.)
    const match = line.match(/D-(\d+)/);
    if (match) {
      currentSection = 'vargaCharts';
      currentVargaChart = `D-${match[1]}`;
      kundliData.vargaCharts[currentVargaChart] = [];
    }
  }

  // Content parsing
  if (currentSection === 'planetaryPositions' && /^[A-Za-z]/.test(line) && !line.startsWith('Body')) {
    const parts = line.split(/\s{2,}/);
    if (parts.length >= 4) {
      kundliData.planetaryPositions.push({
        body: parts[0].trim(),
        longitude: parts[1].trim(),
        nakshatra: parts[2].trim().split(' ')[0],
        pada: parseInt(parts[2].trim().split(' ')[1]),
        rasi: parts[3].trim(),
        navamsa: parts[4] ? parts[4].trim() : null
      });
    }
  }

  if (currentSection === 'charaKarakas' && /^[A-Z]{2}\s+/.test(line)) {
    const parts = line.split(/\s+/);
    kundliData.charaKarakas.push({
      karaka: parts[0],
      planet: parts[1],
      meaning: parts.slice(2).join(' ')
    });
  }

  if (currentSection === 'ashtakavarga' && /^\s{6}(Ar|Ta|Ge|Cn|Le|Vi|Li|Sc|Sg|Cp|Aq|Pi)/.test(line)) {
    const planet = line.trim().split(' ')[0];
    const values = line.match(/\d+/g);
    if (values && values.length === 12) {
      kundliData.ashtakavarga[planet] = values.map(Number);
    }
  }

  if (currentSection === 'planetaryStrengths' && /^[A-Z][a-z]+\s+\d+/.test(line)) {
    const parts = line.split(/\s+/);
    if (parts.length >= 5) {
      kundliData.planetaryStrengths.push({
        planet: parts[0],
        shadbala: parseFloat(parts[1]),
        rupas: parseFloat(parts[2]),
        strengthPercent: parseFloat(parts[3]),
        ishtaPhala: parseFloat(parts[4]),
        kashtaPhala: parts[5] ? parseFloat(parts[5]) : null
      });
    }
  }

  if (currentSection === 'dasas' && /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+\d{4}/.test(line)) {
    const dasaEntries = line.split(/\s{2,}/);
    dasaEntries.forEach(entry => {
      if (entry.trim()) {
        const parts = entry.trim().split(/\s+/);
        if (parts.length >= 3) {
          kundliData.dasas[currentDasaSystem].push({
            planet: parts[0],
            startDate: parts[1],
            endDate: parts[2]
          });
        }
      }
    });
  }

  if (currentSection === 'vargaCharts' && line.includes('|') && !line.startsWith('+---')) {
    kundliData.vargaCharts[currentVargaChart].push(line);
  }
});

rl.on('close', () => {
  fs.writeFileSync(outputPath, JSON.stringify(kundliData, null, 2));
  console.log(`Kundli data successfully saved to ${outputPath}`);
});




// // Fully Updated Kundli Parser with Missing Sections
// const fs = require('fs');
// const readline = require('readline');
// const cors = require('cors');
// app.use(cors());

// const inputPath = 'notes.txt';
// const outputPath = 'newkundli.json';

// const kundliData = {
//   metadata: {},
//   planetaryPositions: [],
//   charaKarakas: [],
//   ashtakavarga: {},
//   planetaryStrengths: [],
//   vargaCharts: {},
//   dasas: {
//     vimshottari: [],
//     moola: [],
//     ashtottari: [],
//     kalachakra: [],
//     narayana: [],
//     sudasa: []
//   },
//   vimsopakaScores: {},
//   planetCharacteristics: [],
//   planetActivity: [],
//   vaiseshikamsas: []
// };

// let section = null;
// let dasaSystem = null;
// let dasaBuffer = [];
// let vargaName = null;
// let vargaBuffer = [];
// let lineNum = 0;

// function processDasaBuffer() {
//   if (!dasaSystem || dasaBuffer.length === 0) return;
//   let lines = dasaBuffer.map(l => l.trim()).filter(Boolean);
//   let entries = [];
//   lines.forEach((line) => {
//     let parts = line.split(/\s+/);
//     if (['vimshottari', 'ashtottari'].includes(dasaSystem)) {
//       for (let i = 0; i < parts.length - 2; i+=3) {
//         entries.push({ planet: parts[i], subPlanet: parts[i+1], startDate: parts[i+2] });
//       }
//     } else if (dasaSystem === 'moola') {
//       let mainPlanet = parts[0];
//       let subPeriods = [];
//       for (let i = 1; i < parts.length - 1; i += 2) {
//         subPeriods.push({ planet: parts[i], date: parts[i+1] });
//       }
//       entries.push({ mainPlanet, subPeriods });
//     } else if (['narayana', 'sudasa'].includes(dasaSystem)) {
//       let mainSign = parts[0];
//       let subPeriods = [];
//       for (let i = 1; i < parts.length - 1; i += 2) {
//         subPeriods.push({ sign: parts[i], date: parts[i+1] });
//       }
//       entries.push({ sign: mainSign, subPeriods });
//     } else if (dasaSystem === 'kalachakra') {
//       let i = 0;
//       while (i < parts.length - 1) {
//         let period = {};
//         if (/\w+\s+\([^)]+\)/.test(parts.slice(i, i+2).join(' '))) {
//           period.period = parts[i];
//           period.nakshatra = parts[i+1].replace(/[()]/g, '');
//           period.date = parts[i+2];
//           i += 3;
//         } else {
//           period.period = parts[i];
//           period.nakshatra = null;
//           period.date = parts[i+1];
//           i += 2;
//         }
//         entries.push(period);
//       }
//     }
//   });
//   kundliData.dasas[dasaSystem] = entries;
//   dasaBuffer = [];
// }

// const rl = readline.createInterface({
//   input: fs.createReadStream(inputPath),
//   crlfDelay: Infinity
// });

// rl.on('line', (raw) => {
//   let line = raw.trim();
//   lineNum++;

//   // --- Section triggers ---
//   if (/^Date:/i.test(line)) section = 'metadata';
//   if (/^Body +Longitude/.test(line)) { section = 'planetaryPositions'; return; }
//   if (/^Chara karaka Planet/.test(line)) { section = 'charaKarakas'; return; }
//   if (/^Ashtakavarga of Rasi Chart/.test(line)) { section = 'ashtakavarga'; return; }
//   if (/^Planet +Shadbala/i.test(line)) { section = 'planetaryStrengths'; return; }
//   if (/^Vaiseshikamsas/.test(line)) { section = 'vaiseshikamsas'; return; }
//   if (/^Vimsopaka Dasa/.test(line)) { section = 'vimsopakaScores'; return; }
//   if (/^Planet +Age/.test(line)) { section = 'planetCharacteristics'; return; }
//   if (/^Planet +Activity/.test(line)) { section = 'planetActivity'; return; }

//   if (/^\+[-]+/.test(line) && /D-\d+/.test(line)) {
//     if (vargaBuffer.length && vargaName) {
//       kundliData.vargaCharts[vargaName] = [...vargaBuffer];
//       vargaBuffer = [];
//     }
//     let m = raw.match(/D-\d+[^\n]*/);
//     vargaName = m ? m[0].trim() : `varga${Object.keys(kundliData.vargaCharts).length+1}`;
//     section = 'vargaChart';
//     return;
//   } else if (/^\+[-]+/.test(line)) {
//     if (vargaBuffer.length && vargaName) {
//       kundliData.vargaCharts[vargaName] = [...vargaBuffer];
//       vargaBuffer = [];
//     }
//     section = null;
//     return;
//   } else if (section === 'vargaChart' && line.includes('|')) {
//     vargaBuffer.push(line);
//     return;
//   }

//   // --- Dasa Systems ---
//   if (/^Vimsottari Dasa/.test(line)) { processDasaBuffer(); section = 'dasa'; dasaSystem = 'vimshottari'; return; }
//   if (/^Moola Dasa/.test(line))      { processDasaBuffer(); section = 'dasa'; dasaSystem = 'moola'; return; }
//   if (/^Ashtottari Dasa/.test(line)) { processDasaBuffer(); section = 'dasa'; dasaSystem = 'ashtottari'; return; }
//   if (/^Kalachakra Dasa/.test(line)) { processDasaBuffer(); section = 'dasa'; dasaSystem = 'kalachakra'; return; }
//   if (/^Narayana Dasa/.test(line))   { processDasaBuffer(); section = 'dasa'; dasaSystem = 'narayana'; return; }
//   if (/^Sudasa/.test(line))          { processDasaBuffer(); section = 'dasa'; dasaSystem = 'sudasa'; return; }

//   // --- Data Capture ---
//   if (section === 'metadata') {
//     let [key, ...rest] = line.split(':');
//     kundliData.metadata[key.trim()] = rest.join(':').trim();
//     return;
//   }

//   if (section === 'planetaryPositions' && line && !line.startsWith('Body')) {
//     let parts = line.split(/\s+/);
//     if (parts.length >= 9) {
//       kundliData.planetaryPositions.push({
//         body: parts[0],
//         longitude: parts.slice(1, 5).join(' '),
//         nakshatra: parts[5],
//         pada: parseInt(parts[6]),
//         rasi: parts[7],
//         navamsa: parts[8]
//       });
//     }
//     return;
//   }

//   if (section === 'charaKarakas') {
//     let p = line.split(/\s+/);
//     kundliData.charaKarakas.push({ karaka: p[0], planet: p[1], meaning: p.slice(2).join(' ') });
//     return;
//   }

//   if (section === 'ashtakavarga') {
//     let m = line.match(/^(As|Su|Mo|Ma|Me|Ju|Ve|Sa)\s+(.+)/);
//     if (m) {
//       kundliData.ashtakavarga[m[1]] = m[2].trim().split(/\s+/).map(x => x.replace(/\*/g,'')).map(Number);
//     }
//     return;
//   }

//   if (section === 'planetaryStrengths' && line && !/^Planet/.test(line)) {
//     let p = line.split(/\s+/);
//     if (p.length >= 6) {
//       kundliData.planetaryStrengths.push({
//         planet: p[0],
//         shadbala: parseFloat(p[1]),
//         rupas: parseFloat(p[2]),
//         strengthPercent: parseFloat(p[3]),
//         ishtaPhala: parseFloat(p[4]),
//         kashtaPhala: parseFloat(p[5])
//       });
//     }
//     return;
//   }

//   if (section === 'vaiseshikamsas') {
//     let p = line.split(/\s{2,}/);
//     if (p.length === 3) {
//       kundliData.vaiseshikamsas.push({ planet: p[0].trim(), dasaVarga: p[1].trim(), shodasaVarga: p[2].trim() });
//     }
//     return;
//   }

//   if (section === 'vimsopakaScores') {
//     let m = line.match(/^(\w+)\s+([\d.]+)\s+\(([^)]+)\)\s+([\d.]+)\s+\(([^)]+)\)\s+([\d.]+)\s+\(([^)]+)\)\s+([\d.]+)\s+\(([^)]+)\)$/);
//     if (m) {
//       kundliData.vimsopakaScores[m[1]] = {
//         dasaVarga: { score: parseFloat(m[2]), percent: m[3] },
//         shodasaVarga: { score: parseFloat(m[4]), percent: m[5] },
//         saptaVarga: { score: parseFloat(m[6]), percent: m[7] },
//         shadVarga: { score: parseFloat(m[8]), percent: m[9] }
//       };
//     }
//     return;
//   }

//   if (section === 'planetCharacteristics') {
//     let p = line.split(/\s{2,}/);
//     if (p.length >= 3) {
//       kundliData.planetCharacteristics.push({ planet: p[0], age: p[1], traits: p[2].split(', ').map(t => t.trim()) });
//     }
//     return;
//   }

//   if (section === 'planetActivity') {
//     let p = line.split(/\s{2,}/);
//     if (p.length === 2) kundliData.planetActivity.push({ planet: p[0], activity: p[1] });
//     return;
//   }

//   if (section === 'dasa' && dasaSystem) {
//     if (/^\s*$/.test(line)) return;
//     dasaBuffer.push(line);
//     return;
//   }
// });

// rl.on('close', () => {
//   processDasaBuffer();
//   if (vargaBuffer.length && vargaName) kundliData.vargaCharts[vargaName] = [...vargaBuffer];
//   fs.writeFileSync(outputPath, JSON.stringify(kundliData, null, 2));
//   console.log(`Saved to ${outputPath}`);
// });
